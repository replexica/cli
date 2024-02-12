import {Command, ux} from '@oclif/core'

export class MyCommand extends Command {
  static hidden: boolean = true;

  async run() {
    ux.info('this is a message')
    // start the spinner
    ux.action.start('starting a process')
    // do some action...
    // stop the spinner
    ux.action.stop() // shows 'starting a process... done'

    // show on stdout instead of stderr
    ux.action.start('starting a process', 'initializing', {stdout: true})
    await delay(1000)
    // update the spinner message
    ux.action.start('starting a process', 'loading', {stdout: true})
    await delay(1000)
    // do some action...
    // stop the spinner with a custom message
    ux.action.stop('custom message') // shows 'starting a process... custom message'
  }
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}