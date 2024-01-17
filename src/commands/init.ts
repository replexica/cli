import { Args, Command } from '@oclif/core';
import _ from 'lodash';
import path from 'path';
import fs from 'fs/promises';
import YAML from 'yaml';
import { demoEnDictionary, defaultConfig, defaultGithubWorkflow, defaultPaths } from '../config/default';

export default class Localize extends Command {
  static args = {
    root: Args.string({
      description: 'Root directory of the repository, containing the .replexica/config.yml config file.',
      default: '.',
      helpValue: '.',
    }),
  }

  static description = 'Initializes a Replexica project.'

  static examples = []

  static flags = {}

  async run(): Promise<void> {
    const { args } = await this.parse(Localize);

    const configRoot = path.resolve(process.cwd(), args.root);
    const configFilePath = path.join(configRoot, '.replexica/config.yml');

    const configFileExists = await fs.stat(configFilePath).then(() => true).catch(() => false);
    if (configFileExists) {
      throw this.error(`Config file already exists at ${configFilePath}`);
    }

    await this.writeDemoDictionary(configRoot);
    await this.writeReplexicaConfig(configRoot);
    await this.writeGithubWorkflow(configRoot);
  }

  private async writeDemoDictionary(configRoot: string) {
    const demoDictionaryContent = JSON.stringify(demoEnDictionary, null, 2);
    await fs.mkdir(path.dirname(path.join(configRoot, defaultPaths.dictionaryEn)), { recursive: true }).catch(() => {});
    const demoDictionaryFilePath = path.join(configRoot, defaultPaths.dictionaryEn);
    await fs.writeFile(demoDictionaryFilePath, demoDictionaryContent);
  }

  private async writeReplexicaConfig(configRoot: string) {
    const configContent = YAML.stringify(defaultConfig);
    await fs.mkdir(path.dirname(path.join(configRoot, defaultPaths.config)), { recursive: true }).catch(() => {});
    const configFilePath = path.join(configRoot, defaultPaths.config);
    await fs.writeFile(configFilePath, configContent);
  }

  private async writeGithubWorkflow(configRoot: string) {
    const githubWorkflowContent = YAML.stringify(defaultGithubWorkflow);
    await fs.mkdir(path.dirname(path.join(configRoot, defaultPaths.githubWorkflow)), { recursive: true }).catch(() => {});
    const githubWorkflowFilePath = path.join(configRoot, defaultPaths.githubWorkflow);
    await fs.writeFile(githubWorkflowFilePath, githubWorkflowContent);
  }
}
