import { LangDataNode } from '.';
import { YamlLangDataProcessor } from './yaml';

export class YamlRorLangDataProcessor extends YamlLangDataProcessor {
  protected async preflatten(langData: LangDataNode, lang: string): Promise<LangDataNode> {
    const innerNode = langData[lang];
    const result = typeof innerNode === 'object' ? innerNode : {};
    return result;
  }

  protected async postunflatten(record: LangDataNode, lang: string): Promise<LangDataNode> {
    const result = { [lang]: record };
    return result;
  }
}
