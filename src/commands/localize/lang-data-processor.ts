import fs from 'fs/promises';
import path from 'path';
import _ from 'lodash';
import SimpleGit from 'simple-git';

export type LangDataType = 'json' | 'xcode';

export type LangDataNode = {
  [key: string]: string | LangDataNode;
};

export interface ILangDataProcessor {
  loadPrevLangJson(path: string, lang: string): Promise<Record<string, string>>;
  loadLangJson(path: string, lang: string): Promise<Record<string, string>>;
  saveLangJson(path: string, lang: string, langData: Record<string, string>): Promise<void>;
}

export interface ILangDataProcessorImpl {
  loadPrevLangData(path: string, lang: string): Promise<LangDataNode>;
  loadLangData(path: string, lang: string): Promise<LangDataNode>;
  saveLangData(path: string, lang: string, langData: LangDataNode): Promise<void>;
}

export abstract class BaseLangDataProcessor implements ILangDataProcessor, ILangDataProcessorImpl {
  abstract loadLangData(filePath: string, lang: string): Promise<LangDataNode>;
  abstract loadPrevLangData(path: string, lang: string): Promise<LangDataNode>;
  abstract saveLangData(filePath: string, lang: string, langData: LangDataNode): Promise<void>;

  async loadPrevLangJson(path: string, lang: string): Promise<Record<string, string>> {
    const langData = await this.loadPrevLangData(path, lang);

    const flat = await import('flat');
    const result = flat.flatten<LangDataNode, Record<string, string>>(langData, {
      delimiter: '/',
      transformKey: (key) => encodeURIComponent(key),
    });

    return result;
  }

  async loadLangJson(path: string, lang: string): Promise<Record<string, string>> {
    const langData = await this.loadLangData(path, lang);

    const flat = await import('flat');
    const result = flat.flatten<LangDataNode, Record<string, string>>(langData, {
      delimiter: '/',
      transformKey: (key) => encodeURIComponent(key),
    });

    return result;
  }

  async saveLangJson(path: string, lang: string, langData: Record<string, string>): Promise<void> {
    const flat = await import('flat');
    const result = flat.unflatten<Record<string, string>, LangDataNode>(langData, {
      delimiter: '/',
      transformKey: (key) => decodeURIComponent(key),
    });

    await this.saveLangData(path, lang, result);
  }
}

export class JsonLangDataProcessor extends BaseLangDataProcessor {
  async parseFileContent(fileContent: string): Promise<LangDataNode> {
    return JSON.parse(fileContent);
  }

  async loadPrevLangData(filePathPattern: string, lang: string): Promise<LangDataNode> {
    if (!filePathPattern.includes('[lang]')) { throw new Error('The file path must include the [lang] placeholder'); }

    const filePath = filePathPattern.replace('[lang]', lang);
    const relativePath = path.relative(process.cwd(), filePath);

    const git = SimpleGit();
    // git log -n 1 --pretty=format:%h -- <file>
    const res = await git.log({ n: 1, pretty: '%h', file: relativePath });
    if (res.all.length === 0) { return {}; }

    const commitHash = res.all[0].hash;
    // get the prev content of the file
    const fileContent = await git.show(`${commitHash}~1:${relativePath}`);
    if (!fileContent) { return {}; }

    const result = await this.parseFileContent(fileContent);

    return result;
  }

  async loadLangData(filePathPattern: string, lang: string): Promise<LangDataNode> {
    if (!filePathPattern.includes('[lang]')) { throw new Error('The file path must include the [lang] placeholder'); }

    const filePath = filePathPattern.replace('[lang]', lang);
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {};
    } else {
      const fileContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(fileContent);
    }
  }

  async saveLangData(filePathPattern: string, lang: string, langData: LangDataNode): Promise<void> {
    if (!filePathPattern.includes('[lang]')) { throw new Error('The file path must include the [lang] placeholder'); }

    const filePath = filePathPattern.replace('[lang]', lang);
    const fileContent = JSON.stringify(langData, null, 2);
    // Create all directories in the path if they don't exist
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });
    // Write the file
    await fs.writeFile(filePath, fileContent);
  }
}

export class XcodeLangDataProcessor extends BaseLangDataProcessor {
  async parseFileContent(fileContent: string, lang: string): Promise<LangDataNode> {
    const parsed = JSON.parse(fileContent);

    const result: LangDataNode = {};
    for (const [translationKey, _translationEntity] of Object.entries(parsed.strings)) {
      const rootTranslationEntity = _translationEntity as any;
      const langTranslationEntity = rootTranslationEntity?.localizations?.[lang];
      if (langTranslationEntity) {
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
    }

    return result;
  }

  async loadPrevLangData(filePath: string, lang: string): Promise<LangDataNode> {
    const relativePath = path.relative(process.cwd(), filePath);

    const git = SimpleGit();
    // git log -n 1 --pretty=format:%h -- <file>
    const res = await git.log({ n: 1, pretty: '%h', file: relativePath });
    if (res.all.length === 0) { return {}; }

    const commitHash = res.all[0].hash;
    // get the prev content of the file
    const fileContent = await git.show(`${commitHash}~1:${relativePath}`);
    if (!fileContent) { return {}; }

    const result = await this.parseFileContent(fileContent, lang);
    return result;
  }

  async loadLangData(filePath: string, lang: string): Promise<LangDataNode> {
    const fileExists = fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return {};
    } else {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const result = await this.parseFileContent(fileContent, lang);

      return result;
    }
  }

  async saveLangData(filePath: string, lang: string, langData: LangDataNode): Promise<void> {
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) { throw new Error('Xcode translation was not found.'); }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    const langDataToMerge: any = {};
    langDataToMerge.strings = {};

    for (const [key, value] of Object.entries(langData)) {
      if (typeof value === 'string') {
        langDataToMerge.strings[key] = {
          extractionState: 'manual',
          localizations: {
            [lang]: {
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
            [lang]: {
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
}
