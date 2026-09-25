import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDataDir, getPlatformDataDir } from './utils'

describe('getDataDir', () => {
    const saved = { ...process.env }
    const platform = process.platform
    let home: string

    const setPlatform = (value: NodeJS.Platform) => Object.defineProperty(process, 'platform', { value })
    const makeDir = (dir: string, withFile = false) => {
        fs.mkdirSync(dir, { recursive: true })
        if (withFile) fs.writeFileSync(path.join(dir, 'database.sqlite'), '')
    }

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'keelflow-home-'))
        process.env.HOME = home
        process.env.USERPROFILE = home
        delete process.env.KEELFLOW_HOME
        delete process.env.XDG_DATA_HOME
        delete process.env.LOCALAPPDATA
        setPlatform('linux')
    })

    afterEach(() => {
        process.env = { ...saved }
        setPlatform(platform)
        fs.rmSync(home, { recursive: true, force: true })
    })

    it('uses the XDG data folder on a new Linux installation', () => {
        expect(getDataDir()).toBe(path.join(home, '.local', 'share', 'keelflow'))
        process.env.XDG_DATA_HOME = path.join(home, 'data')
        expect(getDataDir()).toBe(path.join(home, 'data', 'keelflow'))
    })

    it('ignores a relative XDG_DATA_HOME, as the spec says', () => {
        process.env.XDG_DATA_HOME = 'relative/data'
        expect(getPlatformDataDir()).toBe(path.join(home, '.local', 'share', 'keelflow'))
    })

    it('uses the platform folders on macOS and Windows', () => {
        setPlatform('darwin')
        expect(getDataDir()).toBe(path.join(home, 'Library', 'Application Support', 'keelflow'))
        setPlatform('win32')
        process.env.LOCALAPPDATA = path.join(home, 'Local')
        expect(getDataDir()).toBe(path.join(home, 'Local', 'keelflow'))
        delete process.env.LOCALAPPDATA
        expect(getDataDir()).toBe(path.join(home, 'AppData', 'Local', 'keelflow'))
    })

    it('lets KEELFLOW_HOME win', () => {
        makeDir(path.join(home, '.keelflow'), true)
        process.env.KEELFLOW_HOME = path.join(home, 'custom')
        expect(getDataDir()).toBe(path.join(home, 'custom'))
    })

    it('keeps using ~/.keelflow that holds data (Keelflow 3.2.0)', () => {
        makeDir(path.join(home, '.keelflow'), true)
        makeDir(path.join(home, '.flowise'), true)
        expect(getDataDir()).toBe(path.join(home, '.keelflow'))
    })

    it('keeps using ~/.flowise for installations moved from Flowise', () => {
        makeDir(path.join(home, '.flowise'), true)
        expect(getDataDir()).toBe(path.join(home, '.flowise'))
    })

    it('uses an empty ~/.keelflow that exists, such as the Docker volume mount point', () => {
        makeDir(path.join(home, '.keelflow'))
        expect(getDataDir()).toBe(path.join(home, '.keelflow'))
    })

    it('prefers the platform folder with data over an empty ~/.keelflow', () => {
        makeDir(path.join(home, '.keelflow'))
        makeDir(path.join(home, '.local', 'share', 'keelflow'), true)
        expect(getDataDir()).toBe(path.join(home, '.local', 'share', 'keelflow'))
    })

    it('uses ~/.flowise with data over an empty ~/.keelflow', () => {
        makeDir(path.join(home, '.keelflow'))
        makeDir(path.join(home, '.flowise'), true)
        expect(getDataDir()).toBe(path.join(home, '.flowise'))
    })
})
