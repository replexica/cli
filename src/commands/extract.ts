import { Args, Command, ux } from '@oclif/core';
import path from 'path';
import fs from 'fs/promises';
import _ from 'lodash';
import { getReplexicaClient } from '../engine/client';
import dotenv from 'dotenv';

dotenv.config();

export default class Extract extends Command {
  static args = {
    root: Args.string({
      description: 'Root directory of the repository, containing the .replexica/config.yml config file.',
      default: '.',
      helpValue: '.',
    }),
  }
  
  static hidden = true; // while in development

  static description = 'Extracts localizable text from the current project';

  static examples = [];

  static flags = {};

  async run() {
    const { args } = await this.parse(Extract);
    const dir = path.resolve(process.cwd(), args.root);
    // using fs, read the directory tree
    // and save the relative paths into an array
    // look only for jsx and tsx fles
    console.log(`Scanning ${dir}`);
    const files = await this.readFileTree(dir);
    console.log(`Found ${files.length} files:`);
    const filesToParse = files.filter((file) => {
      const ext = path.extname(file);
      return ext === '.jsx' || ext === '.tsx';
    });
    console.log(`Found ${filesToParse.length} files to parse:`);
    for (const file of filesToParse) {
      const relativePath = path.relative(dir, file);
      console.log(`- ${relativePath}`);
    }

    console.log(''); // empty line

    // for each file, read the content
    for (const file of filesToParse) {
      const relativePath = path.relative(dir, file);
      console.log(`Processing ${relativePath}`);

      const fileContent = await fs.readFile(file, 'utf-8');
      const result = await this.processFile(relativePath, fileContent);
      await fs.writeFile(file, result.content);

      const dictionaryPath = path.join(dir, 'dictionaries', 'en.json');
      const dictionaryExists = await fs.stat(dictionaryPath).catch(() => false);
      let dictionaryContent: string;
      if (dictionaryExists) {
        dictionaryContent = await fs.readFile(dictionaryPath, 'utf-8');
      } else {
        dictionaryContent = '{}';
      }
      const dictionary = JSON.parse(dictionaryContent);
      const newDictionary = _.merge(dictionary, result.dictionary);
      const newDictionaryContent = JSON.stringify(newDictionary, null, 2);

      await fs.mkdir(path.join(dir, 'dictionaries'), { recursive: true });
      await fs.writeFile(dictionaryPath, newDictionaryContent);
    }
  }

  private async processFile(relativePath: string, fileContent: string) {
    const replexica = getReplexicaClient();
    const result = await replexica.extractLocalizableText(fileContent, relativePath);
    return result;
  }

  private async readFileTree(dir: string, filePaths: string[] = []): Promise<string[]> {
    const result: string[] = [...filePaths];
    const entities = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    for (const entity of entities) {
      if (entity.isDirectory()) {
        const partialResult = await this.readFileTree(path.join(dir, entity.name), filePaths);
        result.push(...partialResult);
      } else {
        const partialResult = path.join(dir, entity.name);
        result.push(partialResult);
      }
    }
    return result;
  }
}
