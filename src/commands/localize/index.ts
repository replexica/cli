import { Args, Command, Flags } from '@oclif/core';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig } from '../../config/load';
import { ConfigSchema } from '../../config/schema';
import _ from 'lodash';
import { getReplexicaClient } from '../../engine/client';
import dotenv from 'dotenv';
import { createId } from '@paralleldrive/cuid2';
import { ILangDataProcessor, JsonLangDataProcessor, LangDataType, XcodeLangDataProcessor } from './lang-data-processor';

dotenv.config();

export default class Localize extends Command {
  static args = {
    root: Args.string({
      description: 'Root directory of the repository, containing the .replexica/config.yml config file.',
      default: '.',
      helpValue: '.',
    }),
  }

  static description = 'Localizes the current project'

  static examples = []

  static flags = {
    triggerType: Flags.string({
      description: 'Environment from which the localization is triggered',
      default: 'cli',
      helpValue: 'cli, github-action, bitbucket-pipe, etc.',
    }),
    triggerName: Flags.string({
      description: 'Name of the trigger',
      default: '',
      helpValue: 'If its a git repo - then its the repo name.',
    }),
  }

  static langDataProcessorsMap = new Map<LangDataType, ILangDataProcessor>()
    .set('json', new JsonLangDataProcessor())
    .set('xcode', new XcodeLangDataProcessor());

  async run(): Promise<void> {
    const config = await this.extractConfig();
    for (const project of config.projects) {
      const sourceLangData = await this.loadProjectLangData(project, config.sourceLang);
      const sourceLangDataPrev = await this.loadPrevProjectLangData(project, config.sourceLang);

      const changedKeys = _.difference(
        _.intersection(Object.keys(sourceLangData), Object.keys(sourceLangDataPrev)),
        Object.keys(_.pickBy(sourceLangData, (value, key) => sourceLangDataPrev[key] === value)),
      );

      for (const targetLang of config.targetLangs) {
        const targetLangData = await this.loadProjectLangData(project, targetLang);

        const addedKeys = _.difference(Object.keys(targetLangData), Object.keys(sourceLangData));
        const removedKeys = _.difference(Object.keys(targetLangData), Object.keys(sourceLangData));

        const keysToLocalize = [...addedKeys, ...changedKeys];
        const diffRecord = _.pick(sourceLangData, keysToLocalize);

        const targetLangDataUpdate = await this.translateRecord(project.name, targetLang, diffRecord);

        const newTargetLangData = _.chain(targetLangData)
          .merge(targetLangDataUpdate)
          .omit(removedKeys)
          .value();

        await this.saveProjectLangData(project, targetLang, newTargetLangData);
      }
    }
  }

  private async loadProjectLangData(project: ConfigSchema['projects'][0], lang: string): Promise<Record<string, any>> {
    const processor = Localize.langDataProcessorsMap.get(project.type);
    if (!processor) { throw new Error('Unsupported project type ' + project.type);}

    const result = await processor.loadLangJson(project.dictionary, lang);

    return result;
  }

  private async loadPrevProjectLangData(project: ConfigSchema['projects'][0], lang: string): Promise<Record<string, any>> {
    const processor = Localize.langDataProcessorsMap.get(project.type);
    if (!processor) { throw new Error('Unsupported project type ' + project.type);}

    const result = await processor.loadPrevLangJson(project.dictionary, lang);

    return result;
  }

  private async saveProjectLangData(project: ConfigSchema['projects'][0], lang: string, data: Record<string, any>) {
    const processor = Localize.langDataProcessorsMap.get(project.type);
    if (!processor) { throw new Error('Unsupported project type ' + project.type);}

    await processor.saveLangJson(project.dictionary, lang, data);
  }

  private async extractConfig() {
    const { flags, args } = await this.parse(Localize);

    const configRoot = path.resolve(process.cwd(), args.root);
    const configFilePath = path.join(configRoot, '.replexica/config.yml');

    const configFileExists = await fs.stat(configFilePath).then(() => true).catch(() => false);
    if (!configFileExists) {
      throw this.warn(`Config file not found at ${configFilePath}.`);
    }

    const config: ConfigSchema | null = configFileExists ? loadConfig(configFilePath) : null;

    const sourceLang = flags.sourceLang || config?.languages.source;
    if (!sourceLang) {
      throw this.error('Source language must be specified.');
    }

    const targetLangs = (flags.targetLang || config?.languages.target || []).filter(Boolean);
    if (targetLangs.length === 0) {
      throw this.error('At least one target language must be specified.');
    }

    const projects = config?.projects || [];
    if (projects.length === 0) {
      throw this.error('At least one project must be specified.');
    }

    return {
      sourceLang,
      targetLangs,
      projects,
      triggerType: flags.triggerType,
      triggerName: flags.triggerName,
    };
  }

  private async translateRecord(projectName: string, targetLang: string, data: Record<string, any>): Promise<Record<string, string>> {
    const config = await this.extractConfig();

    console.log(`[${projectName}] ${Object.keys(data).length} keys from ${config.sourceLang} to ${targetLang}...`);
    if (Object.keys(data).length === 0) { return {}; }

    return data;

    // const replexica = getReplexicaClient();
    // const groupId = `leg_${createId()}`;
    // const translateRecordResponse = await replexica.localizeJson({
    //   groupId,
    //   triggerType: config.triggerType,
    //   triggerName: config.triggerName,

    //   sourceLocale: config.sourceLang,
    //   targetLocale: targetLang,
    //   data,
    // });

    // return translateRecordResponse.data;
  }
}
