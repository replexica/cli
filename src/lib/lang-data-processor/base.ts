export type LangDataType = 'json' | 'xcode' | 'yaml';

export type LangDataNode = {
  [key: string]: string | LangDataNode;
};

export interface ILangDataProcessor {
  loadLangJson(path: string, lang: string): Promise<Record<string, string>>;
  saveLangJson(path: string, lang: string, langData: Record<string, string>): Promise<void>;
}

export abstract class BaseLangDataProcessor {
  protected abstract validatePath(path: string, lang: string): Promise<void | never>;

  protected async flatten(langData: LangDataNode): Promise<Record<string, string>> {
    const flat = await import('flat');
    const result = flat.flatten<LangDataNode, Record<string, string>>(langData, {
      delimiter: '/',
      transformKey: (key) => encodeURIComponent(key),
    });

    return result;
  }

  protected async unflatten(record: Record<string, string>): Promise<LangDataNode> {
    const flat = await import('flat');
    const result = flat.unflatten<Record<string, string>, LangDataNode>(record, {
      delimiter: '/',
      transformKey: (key) => decodeURIComponent(key),
    });

    return result;
  }
}