import { Args, Command, Flags } from '@oclif/core';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig } from '../config/load';
import { ConfigSchema } from '../config/schema';
import _ from 'lodash';
import { getReplexicaClient } from '../engine/client';
import dotenv from 'dotenv';
import { createId } from '@paralleldrive/cuid2';

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
    sourceLang: Flags.string({
      description: 'Language to use as the source language',
      helpValue: 'en',
    }),
    targetLang: Flags.string({
      description: 'Language(s) to use as the target language',
      helpValue: 'es',
      multiple: true,
    }),
    project: Flags.string({
      description: 'Project name(s)',
      helpValue: 'demo',
      multiple: true,
    }),
    dictionary: Flags.string({
      description: 'Dictionary(s) file path pattern',
      helpValue: 'demo/[lang].json',
      multiple: true,
    }),
  }

  async run(): Promise<void> {
    const { configRoot, projectsMapObj, sourceLang, targetLangs, triggerType, triggerName } = await this.extractConfig();

    for (const [projectName, dictionaryPattern] of Object.entries(projectsMapObj)) {
      for (const targetLang of targetLangs) {
        const sourceLangFilePath = path.resolve(configRoot, dictionaryPattern.replace('[lang]', sourceLang));
        const targetLangFilePath = path.resolve(configRoot, dictionaryPattern.replace('[lang]', targetLang));

        const [sourceLangData, targetLangData] = await Promise.all([
          this.loadLangData(sourceLangFilePath),
          this.loadLangData(targetLangFilePath),
        ]);

        const newTargetLangData = await this.localizeProject(
          triggerType,
          triggerName,
          projectName,
          sourceLang,
          sourceLangData,
          targetLang,
          targetLangData,
        );

        await this.saveLangData(targetLangFilePath, newTargetLangData);
      }
    }
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

    const projects = (flags.project || config?.projects?.map((v) => v.name) || []).filter(Boolean);
    if (projects.length === 0) {
      throw this.error('At least one project must be specified.');
    }

    const dictionaries = (flags.dictionary || config?.projects?.map((v) => v.dictionary) || []).filter(Boolean);
    if (dictionaries.length === 0) {
      throw this.error('At least one dictionary must be specified.');
    }

    if (dictionaries.length !== projects.length) {
      throw this.error('The number of dictionaries must match the number of projects.');
    }
    const projectsMapObj = _.zipObject(projects, dictionaries);

    const triggerType = flags.triggerType;
    const triggerName = flags.triggerName;

    return { configRoot, projectsMapObj, sourceLang, targetLangs, triggerName, triggerType };
  }

  private async localizeProject(
    triggerType: string,
    triggerName: string,
    projectName: string,
    sourceLang: string,
    sourceLangData: Record<string, string>,
    targetLang: string,
    targetLangData: Record<string, string>,
  ) {
    const missingKeys = _.difference(Object.keys(sourceLangData), Object.keys(targetLangData));
    const recordToTranslate = _.pick(sourceLangData, missingKeys);
    const translatedRecord = await this.translateRecord(
      triggerType,
      triggerName,
      projectName,
      {
        source: sourceLang,
        target: targetLang,
        data: recordToTranslate,
      },
    );

    const extraneousKeys = _.difference(Object.keys(targetLangData), Object.keys(sourceLangData));
    const extraneousNullifiedRecord = _.zipObject(extraneousKeys, extraneousKeys.map(() => null));

    const finalLangData = _.merge({}, targetLangData, translatedRecord, extraneousNullifiedRecord);
    const cleanedLangData = _.omitBy(finalLangData, _.isNull);

    return cleanedLangData;
  }

  private async loadLangData(langFilePath: string) {
    const langFileExists = await fs.stat(langFilePath).then(() => true).catch(() => false);
    const langFileContent = langFileExists ? await fs.readFile(langFilePath, 'utf8') : '{}';
    const langFileData = JSON.parse(langFileContent);
    return langFileData;
  }

  private async saveLangData(langFilePath: string, data: Record<string, string>) {
    const langFileContent = JSON.stringify(data, null, 2);
    await fs.writeFile(langFilePath, langFileContent);
  }

  private async translateRecord(triggerType: string, triggerName: string, projectName: string, params: TranslateRecordParams): Promise<Record<string, string>> {
    console.log(`[${projectName}] ${Object.keys(params.data).length} keys from ${params.source} to ${params.target}...`);
    if (Object.keys(params.data).length === 0) {
      return {};
    }
    const replexica = getReplexicaClient();
    const groupId = `leg_${createId()}`;
    const translateRecordResponse = await replexica.localizeJson({
      groupId,
      triggerType,
      triggerName,

      sourceLocale: params.source,
      targetLocale: params.target,
      data: params.data,
    });
    return translateRecordResponse.data;
  }
}

type TranslateRecordParams = {
  source: string;
  target: string;
  data: Record<string, string>;
};
