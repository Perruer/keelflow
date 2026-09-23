import { Platform } from '../../Interface'

/** Keelflow is always the open source edition */
const getSettings = async () => ({ PLATFORM_TYPE: Platform.OPEN_SOURCE })

export default {
    getSettings
}
