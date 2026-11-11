import { INodeParams, INodeCredential } from '../src/Interface'

class KeenableApi implements INodeCredential {
    label: string
    name: string
    version: number
    description: string
    inputs: INodeParams[]

    constructor() {
        this.label = 'Keenable API'
        this.name = 'keenableApi'
        this.version = 1.0
        this.description =
            'Optional. Without a key the Keenable nodes use the keyless free tier. Get a key from the <a target="_blank" href="https://keenable.ai">Keenable dashboard</a> to lift rate limits and enable realtime mode.'
        this.inputs = [
            {
                label: 'Keenable API Key',
                name: 'keenableApiKey',
                type: 'password'
            }
        ]
    }
}

module.exports = { credClass: KeenableApi }
