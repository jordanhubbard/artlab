import { StandaloneRunner }  from './runtime/StandaloneRunner.js'
import * as solarSystem from '../examples/solar-system/solar-system.js'

const runner = new StandaloneRunner(document.getElementById('canvas'))
runner.run(solarSystem)
