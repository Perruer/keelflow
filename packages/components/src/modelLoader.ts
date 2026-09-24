import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { INodeOptionsValue } from './Interface'

export enum MODEL_TYPE {
    CHAT = 'chat',
    LLM = 'llm',
    EMBEDDING = 'embedding'
}

const getModelsJSONPath = (): string => {
    const checkModelsPaths = [path.join(__dirname, '..', 'models.json'), path.join(__dirname, '..', '..', 'models.json')]
    for (const checkPath of checkModelsPaths) {
        if (fs.existsSync(checkPath)) {
            return checkPath
        }
    }
    return ''
}

const isValidUrl = (urlString: string) => {
    let url
    try {
        url = new URL(urlString)
    } catch (e) {
        return false
    }
    return url.protocol === 'http:' || url.protocol === 'https:'
}

// A remote model list is fetched at most once an hour
const REMOTE_CACHE_MS = 60 * 60 * 1000
let remoteCache: { url: string; data: any; at: number } | undefined

/**
 * Load the raw model file from MODEL_LIST_CONFIG_JSON (a URL or a local file) when set.
 * Otherwise, or if loading fails, use the models.json shipped with Keelflow. Flowise fetched
 * the list from GitHub on every call by default; Keelflow makes no request unless asked to.
 */
const getRawModelFile = async () => {
    const modelFile = process.env.MODEL_LIST_CONFIG_JSON
    try {
        if (!modelFile) throw new Error('No custom model list configured')
        if (isValidUrl(modelFile)) {
            if (remoteCache && remoteCache.url === modelFile && Date.now() - remoteCache.at < REMOTE_CACHE_MS) return remoteCache.data
            const resp = await axios.get(modelFile, { timeout: 10000 })
            if (resp.status === 200 && resp.data) {
                remoteCache = { url: modelFile, data: resp.data, at: Date.now() }
                return resp.data
            } else {
                throw new Error('Error fetching model list')
            }
        } else if (fs.existsSync(modelFile)) {
            const models = await fs.promises.readFile(modelFile, 'utf8')
            if (models) {
                return JSON.parse(models)
            }
        }
        throw new Error('Model file does not exist or is empty')
    } catch (e) {
        const models = await fs.promises.readFile(getModelsJSONPath(), 'utf8')
        if (models) {
            return JSON.parse(models)
        }
        return {}
    }
}

const getModelConfig = async (category: MODEL_TYPE, name: string) => {
    const models = await getRawModelFile()

    const categoryModels = models[category]
    return categoryModels.find((model: INodeOptionsValue) => model.name === name)
}

export const getModelConfigByModelName = async (category: MODEL_TYPE, provider: string | undefined, name: string | undefined) => {
    const models = await getRawModelFile()

    const categoryModels = models[category]
    return getSpecificModelFromCategory(categoryModels, provider, name)
}

const getSpecificModelFromCategory = (categoryModels: any, provider: string | undefined, name: string | undefined) => {
    for (const cm of categoryModels) {
        if (cm.models && cm.name.toLowerCase() === provider?.toLowerCase()) {
            for (const m of cm.models) {
                if (m.name === name) {
                    return m
                }
            }
        }
    }
    return undefined
}

export const getModels = async (category: MODEL_TYPE, name: string) => {
    const returnData: INodeOptionsValue[] = []
    try {
        const modelConfig = await getModelConfig(category, name)
        returnData.push(...modelConfig.models)
        return returnData
    } catch (e) {
        throw new Error(`Error: getModels - ${e}`)
    }
}

export const getRegions = async (category: MODEL_TYPE, name: string) => {
    const returnData: INodeOptionsValue[] = []
    try {
        const modelConfig = await getModelConfig(category, name)
        returnData.push(...modelConfig.regions)
        return returnData
    } catch (e) {
        throw new Error(`Error: getRegions - ${e}`)
    }
}
