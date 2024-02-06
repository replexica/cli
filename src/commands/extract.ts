import { Args, Command, Flags, ux } from '@oclif/core';
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

  static flags = {
    interactive: Flags.boolean({
      description: 'Run in interactive mode, prompting for user input between prcessing the files',
      default: false,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(Extract);
    const dir = path.resolve(process.cwd(), args.root);
    // Read entire file tree
    ux.action.start(`Reading file tree from ${dir}`);
    const files = await this.readFileTree(dir);
    // Leave only jsx / tsx files
    const eligibleFiles = files
      // Include only files with .tsx or .jsx extension
      .filter((filePath) => ['.tsx', '.jsx'].includes(path.extname(filePath)))
      // Revers to process root files first
      .reverse();
    ux.action.stop(`${eligibleFiles.length} eligible files found`);
    // For each file:
    // - read content
    // - extract localizable text + related dictionary pairs
    // - write modified content back to the file
    // - merge new dictionary keys back into the dictionary file
    for (const filepath of eligibleFiles) {
      // If interactive mode is enabled, wait for user keypress to continue
      // Enter - continue
      // Esc - stop
      // Space - skip current file
      if (flags.interactive) {
        const keypress = await ux.prompt('Press Enter to continue, Space to skip, or Esc to stop', { type: 'hide' });
        if (keypress === ' ') {
          continue;
        }
        if (keypress === 'Escape') {
          break;
        }
      }

      // Calc relative file path
      const relativeFilepath = path.relative(dir, filepath);
      // Read file content
      ux.action.start(`Reading ${relativeFilepath}`);
      const fileContent = await fs.readFile(filepath, 'utf-8');
      ux.action.stop();
      // Extract localizable text
      ux.action.start(`Extracting localizable text from ${relativeFilepath}`);
      const result = await this.processFile(relativeFilepath, fileContent);
      ux.action.stop();
      // Write modified content back to the file
      ux.action.start(`Writing modified content to ${relativeFilepath}`);
      await fs.writeFile(filepath, result.content);
      ux.action.stop();
      // Merge new dictionary keys back into the dictionary file
      ux.action.start(`Merging new dictionary keys into the dictionary file`);
      // TODO: paths should be configurable, taken from the config file
      const dictionaryPath = path.resolve(dir, 'dictionaries/en.json');
      // Check if dictionary file exists
      const dictionaryExists = await fs.stat(dictionaryPath).then(() => true).catch(() => false);
      // Create folders for the dictionary file path
      await fs.mkdir(path.dirname(dictionaryPath), { recursive: true });
      // Read existing dictionary file
      let dictionaryContent;
      if (dictionaryExists) {
        dictionaryContent = await fs.readFile(dictionaryPath, 'utf-8');
      } else {
        dictionaryContent = '{}';
      }
      // Parse dictionary file
      const dictionary = JSON.parse(dictionaryContent);
      // Merge new dictionary keys
      const newDictionary = _.merge(dictionary, result.dictionary);
      // Write dictionary file
      await fs.writeFile(dictionaryPath, JSON.stringify(newDictionary, null, 2));
      ux.action.stop();
    }

    ux.log('Done!');
  }

  private async processFile(relativePath: string, fileContent: string) {
    const replexica = getReplexicaClient();
    const result = await replexica.extractLocalizableText(fileContent, relativePath);
    return result;
  }

  private async readFileTree(dir: string): Promise<string[]> {
    const result: string[] = [];
    const entities = await fs.readdir(dir, { withFileTypes: true });
    for (const entity of entities) {
      if (entity.isFile()) {
        const absolutePath = path.resolve(dir, entity.name);
        result.push(absolutePath);
      } else {
        const subDir = path.resolve(dir, entity.name);
        const subFiles = await this.readFileTree(subDir);
        result.push(...subFiles);
      }
    }
    return result;
  }
}
