

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
    key: Flags.string({
      description: 'Key(s) to localize',
      multiple: true,
    }),
  }

  async run(): Promise<void> {
    const config = await this.extractConfig2();
    for (const project of config.projects) {
      const sourceLangData = await this.loadProjectLangData(project, config.sourceLang);
      for (const targetLang of config.targetLangs) {
        const targetLangData = await this.loadProjectLangData(project, targetLang);

        const newTargetLangData = await this.localizeProject(
          config.triggerType,
          config.triggerName,
          project.name,
          config.sourceLang,
          sourceLangData,
          targetLang,
          targetLangData,
          config.keyOverrides,
        );

        await this.saveProjectLangData(project, targetLang, newTargetLangData);
      }
    }
  }

  private async loadProjectLangData(project: ConfigSchema['projects'][0], lang: string): Promise<Record<string, any>> {
    switch (project.type) {
      case 'json': {
        const rootPath = path.resolve(process.cwd());
        const actualPath = project.dictionary.replace('[lang]', lang);
        const filePath = path.join(rootPath, actualPath);
        return this.loadPureJsonLangData(filePath);
      }
      case 'xcode': {
        const rootPath = path.resolve(process.cwd());
        const filePath = path.join(rootPath, project.dictionary);
        return this.loadXcodeLangData(filePath, lang);
      }
      default:
        throw new Error('Unsupported project type');
    }
  }

  private async saveProjectLangData(project: ConfigSchema['projects'][0], lang: string, data: Record<string, any>) {
    switch (project.type) {
      case 'json': {
        const rootPath = path.resolve(process.cwd());
        const actualPath = project.dictionary.replace('[lang]', lang);
        const filePath = path.join(rootPath, actualPath);
        return this.savePureJsonLangData(filePath, data);
      }
      case 'xcode': {
        const rootPath = path.resolve(process.cwd());
        const filePath = path.join(rootPath, project.dictionary);
        return this.saveXcodeLangData(filePath, data, lang);
      }
      default:
        throw new Error('Unsupported project type');
    }
  }

  private async loadXcodeLangData(filePath: string, lang: string) {
    const fileExists = fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {};
    } else {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(fileContent);

      const result: Record<string, string | Record<string, string>> = {};
      for (const [translationKey, _translationEntity] of Object.entries(parsed.strings)) {
        const rootTranslationEntity = _translationEntity as any;
        const langTranslationEntity = rootTranslationEntity?.localizations?.[lang];
        if ('stringUnit' in langTranslationEntity) {
          result[translationKey] = langTranslationEntity.stringUnit.value;
        } else if ('variations' in langTranslationEntity) {
          if ('plural' in langTranslationEntity.variations) {
            result[translationKey] = {
              one: langTranslationEntity.variations.plural.one?.stringUnit?.value || '',
              other: langTranslationEntity.variations.plural.other?.stringUnit?.value || '',
              zero: langTranslationEntity.variations.plural.zero?.stringUnit?.value || '',
            };
          }
        }
      }

      return result;
    }
  }

  private async loadPureJsonLangData(filePath: string) {
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {};
    } else {
      const fileContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(fileContent);
    }
  }

  private async savePureJsonLangData(filePath: string, data: Record<string, string>) {
    const fileContent = JSON.stringify(data, null, 2);
    // Create all directories in the path if they don't exist
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });
    // Write the file
    await fs.writeFile(filePath, fileContent);
  }

  private async saveXcodeLangData(filePath: string, data: Record<string, string | Record<string, string>>, targetLang: string) {
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) { throw new Error('Xcoxe translation was not found.'); }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    const langDataToMerge: any = {};
    langDataToMerge.strings = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        langDataToMerge.strings[key] = {
          extractionState: 'manual',
          localizations: {
            [targetLang]: {
              stringUnit: {
                state: 'translated',
                value,
              },
            },
          },
        };
      } else {
        langDataToMerge.strings[key] = {
          extractionState: 'manual',
          localizations: {
            [targetLang]: {
              variations: {
                plural: {
                  one: {
                    stringUnit: {
                      state: 'translated',
                      value: value.one,
                    },
                  },
                  other: {
                    stringUnit: {
                      state: 'translated',
                      value: value.other,
                    },
                  },
                  zero: {
                    stringUnit: {
                      state: 'translated',
                      value: value.zero,
                    },
                  },
                },
              },
            },
          },
        };
      }
    }

    const result = _.mergeWith(parsed, langDataToMerge, (objValue, srcValue) => {
      if (_.isObject(objValue)) {
        // If the value is an object, merge it deeply
        return _.merge(objValue, srcValue);
      }
    });

    // Write the file
    await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  }

  private async extractConfig2() {
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
      keyOverrides: flags.key,
      triggerType: flags.triggerType,
      triggerName: flags.triggerName,
    };
  }

  private async localizeProject(
    triggerType: string,
    triggerName: string,
    projectName: string,
    sourceLang: string,
    sourceLangData: Record<string, string>,
    targetLang: string,
    targetLangData: Record<string, string>,
    keysToLocalize?: string[],
  ) {
    let finalKeys: string[];
    if (keysToLocalize) {
      finalKeys = keysToLocalize;
    } else {
      const missingKeys = _.difference(Object.keys(sourceLangData), Object.keys(targetLangData));
      finalKeys = missingKeys;
    }
    const recordToTranslate = _.pick(sourceLangData, finalKeys);
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
