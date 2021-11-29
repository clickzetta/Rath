import { IFieldSummary, IInsightSpace } from "visual-insights";
import { StatFuncName } from "visual-insights/build/esm/statistics";
import { IFieldMeta, IRow, ISyncEngine } from "../../interfaces";
import { IRathStorage } from "../../utils/storage";
import { RathCHEngine } from "./clickhouse";
// import { isSetEqual } from "../../utils/index";
import { RathEngine } from "./core";

const EngineRef: { current: RathEngine | null, mode: 'webworker' } | { current: RathCHEngine | null, mode: 'clickhouse' } = {
    mode: 'webworker',
    current: null
}

export interface MessageProps {
    task: 'init' | 'destroy' | 'start' | 'specification' | 'associate' | 'detail' | 'cube' | 'download' | 'upload' | 'sync';
    props?: any
}

function initEngine (engineMode: string) {
    if (engineMode === 'webworker') {
        EngineRef.current = new RathEngine();
        EngineRef.mode = engineMode;
    } else if (engineMode === 'clickhouse') {
        EngineRef.current = new RathCHEngine();
        EngineRef.current.utils.setCHConfig({
            protocol: 'https',
            host: 'localhost',
            port: 2333,
            path: '/api/ch/general'
        })
        EngineRef.mode = engineMode;
    }
    console.log(`Rath engine is created, engine mode is [${EngineRef.mode}].`)
}

function destroyEngine () {
    EngineRef.current = null;
}

type StartPipeLineProps = {
    mode: 'webworker';
    dataSource: IRow[];
    fieldMetas: IFieldMeta[];
} | {
    mode: 'clickhouse';
    fieldMetas: IFieldMeta[];
    viewName: string;
}

async function startPipeLine (props: StartPipeLineProps) {
    const times: number[] = [];
    const prints: IRow[] = [];
    let insightSpaces: IInsightSpace[] = [];
    let viewSampleData: IRow[] = [];
    let viewFields: IFieldSummary[] = [];
    times.push(performance.now())
    console.log('[computation engine mode]', props.mode)
    if (EngineRef.mode === 'webworker' && props.mode === 'webworker') {
        const { dataSource, fieldMetas } = props;
        const fieldsProps = fieldMetas.map(f => ({ key: f.fid, semanticType: f.semanticType, analyticType: f.analyticType, dataType: '?' as '?' }));
        const engine = EngineRef.current;
        if (engine === null) throw new Error('Engine is not created.');
        engine.setData(dataSource)
            .setFields(fieldsProps)
        engine.univarSelection();
        times.push(performance.now())
        prints.push({ task: 'init&univar', value: times[times.length - 1] - times[times.length - 2] })
        engine.buildGraph();
        times.push(performance.now())
        prints.push({ task: 'co-graph', value: times[times.length - 1] - times[times.length - 2] })
        engine.clusterFields();
        times.push(performance.now())
        prints.push({ task: 'clusters', value: times[times.length - 1] - times[times.length - 2] })
        engine.buildCube();
        times.push(performance.now())
        prints.push({ task: 'cube', value: times[times.length - 1] - times[times.length - 2] })
        engine.buildSubspaces();
        times.push(performance.now())
        prints.push({ task: 'subspaces', value: times[times.length - 1] - times[times.length - 2] });
        engine.createInsightSpaces();
        times.push(performance.now())
        prints.push({ task: 'insights', value: times[times.length - 1] - times[times.length - 2] })
        engine.setInsightScores();
        times.push(performance.now())
        prints.push({ task: 'scores', value: times[times.length - 1] - times[times.length - 2] })
        engine.insightSpaces = engine.insightSpaces.filter(s => typeof s.score === 'number' && !isNaN(s.score));
        // engine.insightSpaces.sort((a, b) => Number(a.score) - Number(b.score));
        engine.insightSpaces.sort((a, b) => Number(b.impurity) - Number(a.impurity));
        viewFields = engine.fields;
        insightSpaces = engine.insightSpaces;
        viewSampleData = engine.dataSource;
    } else if (EngineRef.mode === 'clickhouse' && props.mode === 'clickhouse') {
        const engine = EngineRef.current;
        if (engine === null) throw new Error('Engine is not created.');
        const { viewName } = props;
        // engine.setRawFields(fieldsProps);
        await engine.uvsView(viewName);
        await engine.buildDataGraph();
        engine.clusterFields();
        engine.buildSubspaces();
        insightSpaces = await engine.fastInsightRecommand();
        viewFields = engine.fields;
        viewSampleData = await engine.loadData(viewName);
    } else {
        throw new Error(`Engine mode is not support: ${props.mode}`)
    }
    return {
        insightSpaces,
        fields: viewFields,
        dataSource: viewSampleData,
        performance: prints
    };
}

async function specify (space: IInsightSpace) {
    const engine = EngineRef.current;
    if (engine === null) throw new Error('Engine is not created.');
    return engine.specification(space)
}

function scanDetails (spaceIndex: number) {
    const engine = EngineRef.current;
    if (engine === null) throw new Error('Engine is not created.');
    const space = engine.insightSpaces[spaceIndex];
    if (space) {
        return engine.scanDetail(space)
    } else {
        throw new Error(`insightSpaces(${spaceIndex}/${engine.insightSpaces.length}) not exist.`)
    }
}

async function associate (spaceIndex: number) {
    const engine = EngineRef.current;
    if (engine === null) throw new Error('Engine is not created.');
    engine.associate(spaceIndex);
    if (EngineRef.mode === 'webworker' && EngineRef.mode === 'webworker') {
        return engine.associate(spaceIndex);
    } else if (EngineRef.mode === 'clickhouse' && EngineRef.mode === 'clickhouse') {
        return engine.associate(spaceIndex);
    }
}

function aggregate (props: { dimensions: string[]; measures: string[]; aggregators: StatFuncName[] }): IRow[] {
    if (EngineRef.mode === 'webworker' && EngineRef.mode === 'webworker') {
        const engine = EngineRef.current;
        if (engine === null) throw new Error('Engine is not created.');
        const { dimensions, measures, aggregators } = props;
        const cube = engine.cube;
        const cuboid = cube.getCuboid(dimensions);
        const aggData = cuboid.getState(measures, aggregators);
        return aggData;
    } else if (EngineRef.mode === 'clickhouse' && EngineRef.mode === 'clickhouse') {
        const engine = EngineRef.current;
        if (engine === null) throw new Error('Engine is not created.');
        // engine.loadD
        // return engine.associate(spaceIndex);
        return []
    }
    return []
}

function exportResult (): Pick<IRathStorage, 'dataStorage' | 'engineStorage'> {
    if (EngineRef.mode === 'webworker') {
        const engine = EngineRef.current
        if (engine === null) throw new Error('Engine is not created.');
        const ser = engine.serialize();
        return {
            dataStorage: JSON.stringify(ser.dataStorage),
            engineStorage: JSON.stringify(ser.storage)
        }
    } else {
        throw new Error('Not supported current data engine type.')
    }
}

function importFromUploads(props: Pick<IRathStorage, 'dataStorage' | 'engineStorage'>) {
    if (EngineRef.mode === 'webworker') {
        const engine = EngineRef.current
        if (engine === null) throw new Error('Engine is not created.');
        const { dataStorage, engineStorage } = props;
        engine.deSerialize(JSON.parse(engineStorage), JSON.parse(dataStorage))
    } else {
        throw new Error('Not supported current data engine type.')
    }
}

function syncEngine (): ISyncEngine {
    if (EngineRef.mode === 'webworker') {
        const engine = EngineRef.current
        if (engine === null) throw new Error('Engine is not created.');
        return {
            fields: engine.fields,
            dataSource: engine.dataSource,
            insightSpaces: engine.insightSpaces
        }
    } else {
        throw new Error('Not supported current data engine type.')
    }
}

export async function router (e: { data: MessageProps }, onSuccess: (res?: any) => void, onFailed: (res: string) => void) {
    const req = e.data;
    console.log(req.task, 'worker router')
    try {
        switch (req.task) {
            case 'cube':
                const aggData = aggregate(req.props);
                onSuccess(aggData);
                break;
            case 'init':
                initEngine(req.props);
                onSuccess()
                break;
            case 'destroy':
                destroyEngine();
                onSuccess()
                break;
            case 'start':
                const res_start = await startPipeLine(req.props);
                onSuccess(res_start);
                break;
            case 'specification':
                const res_spec = await specify(req.props);
                onSuccess(res_spec)
                break;
            case 'associate':
                const res_asso = await associate(req.props);
                onSuccess(res_asso)
                break;
            case 'detail':
                const res_details = scanDetails(req.props);
                onSuccess(res_details)
                break;
            case 'download':
                const res_result = exportResult();
                onSuccess(res_result)
                break;
            case 'sync':
                const res_sync = syncEngine();
                onSuccess(res_sync);
                break;
            case 'upload':
                const res_upload = importFromUploads(req.props);
                onSuccess(res_upload)
                break;
            default:
                throw new Error(`Unknow task: "${req.task}".`)
        }
    } catch (error) {
        onFailed(`[${req.task}]${error}`)
    }
}