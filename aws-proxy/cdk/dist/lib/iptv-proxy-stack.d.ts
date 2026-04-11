import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
/**
 * IptvProxyStack
 *
 * Cria uma Lambda Function URL pública para a API IPTV Samsung.
 * Região: ca-central-1 (definida no bin/iptv-proxy.ts).
 *
 * Endpoints servidos:
 *   /api/health, /api/live/catalog, /api/vod/movies/catalog,
 *   /api/vod/series/catalog, /api/vod/movies/info, /api/vod/series/info,
 *   /api/proxy
 */
export declare class IptvProxyStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
