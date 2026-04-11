import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

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
export class IptvProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // LAMBDA_PUBLIC_BASE: passado via contexto CDK após o 1.º deploy (para reescrita de M3U8)
    const lambdaPublicBase = (
      (this.node.tryGetContext('lambdaPublicBase') as string | undefined) ?? ''
    ).trim().replace(/\/+$/, '');

    // -------------------------------------------------------------------------
    // Log Group — retenção de 30 dias
    // -------------------------------------------------------------------------
    const logGroup = new logs.LogGroup(this, 'IptvProxyLogGroup', {
      logGroupName: '/aws/lambda/iptv-proxy-fn',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------------------------
    // Lambda Function
    // -------------------------------------------------------------------------
    const proxyFn = new lambda.Function(this, 'IptvProxyFn', {
      functionName: 'iptv-proxy-fn',
      description: 'API IPTV Samsung — catálogo Live/VOD, proxy Xtream (Function URL)',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      // Aponta para aws-proxy/lambda/ (onde os módulos são copiados antes do deploy)
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      timeout: cdk.Duration.seconds(29),
      memorySize: 1024,
      logGroup,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        LAMBDA_PUBLIC_BASE: lambdaPublicBase,
      },
    });

    // -------------------------------------------------------------------------
    // Lambda Function URL — pública, sem autenticação AWS IAM
    // Response Streaming: permite respostas até 20 MB.
    // -------------------------------------------------------------------------
    const functionUrl = proxyFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------
    new cdk.CfnOutput(this, 'IptvProxyFunctionUrl', {
      value: functionUrl.url,
      exportName: 'IptvProxyFunctionUrl',
      description:
        'URL da Lambda Function — usar como VITE_HYBRID_API_BASE_URL e VITE_BACKEND_API no .env.tizen',
    });

    new cdk.CfnOutput(this, 'IptvProxyFunctionName', {
      value: proxyFn.functionName,
      description: 'Nome da Lambda Function',
    });

    new cdk.CfnOutput(this, 'IptvProxyLogGroupName', {
      value: logGroup.logGroupName,
      description: 'CloudWatch Log Group da Lambda',
    });
  }
}
