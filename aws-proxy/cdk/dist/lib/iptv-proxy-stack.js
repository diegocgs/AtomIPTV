"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IptvProxyStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const logs = require("aws-cdk-lib/aws-logs");
const path = require("path");
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
class IptvProxyStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // LAMBDA_PUBLIC_BASE: passado via contexto CDK após o 1.º deploy (para reescrita de M3U8)
        const lambdaPublicBase = (this.node.tryGetContext('lambdaPublicBase') ?? '').trim().replace(/\/+$/, '');
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
            description: 'URL da Lambda Function — usar como VITE_HYBRID_API_BASE_URL e VITE_BACKEND_API no .env.tizen',
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
exports.IptvProxyStack = IptvProxyStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXB0di1wcm94eS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9pcHR2LXByb3h5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUVuQyxpREFBaUQ7QUFDakQsNkNBQTZDO0FBQzdDLDZCQUE2QjtBQUU3Qjs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwwRkFBMEY7UUFDMUYsTUFBTSxnQkFBZ0IsR0FBRyxDQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBd0IsSUFBSSxFQUFFLENBQzFFLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUU3Qiw0RUFBNEU7UUFDNUUsa0NBQWtDO1FBQ2xDLDRFQUE0RTtRQUM1RSxNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzVELFlBQVksRUFBRSwyQkFBMkI7WUFDekMsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUztZQUN2QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILDRFQUE0RTtRQUM1RSxrQkFBa0I7UUFDbEIsNEVBQTRFO1FBQzVFLE1BQU0sT0FBTyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3ZELFlBQVksRUFBRSxlQUFlO1lBQzdCLFdBQVcsRUFBRSxtRUFBbUU7WUFDaEYsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QiwrRUFBK0U7WUFDL0UsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ2pFLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLElBQUk7WUFDaEIsUUFBUTtZQUNSLFdBQVcsRUFBRTtnQkFDWCxZQUFZLEVBQUUsc0JBQXNCO2dCQUNwQyxrQkFBa0IsRUFBRSxnQkFBZ0I7YUFDckM7U0FDRixDQUFDLENBQUM7UUFFSCw0RUFBNEU7UUFDNUUsMERBQTBEO1FBQzFELG1EQUFtRDtRQUNuRCw0RUFBNEU7UUFDNUUsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQztZQUN6QyxRQUFRLEVBQUUsTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUk7WUFDekMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsZUFBZTtTQUM5QyxDQUFDLENBQUM7UUFFSCw0RUFBNEU7UUFDNUUsVUFBVTtRQUNWLDRFQUE0RTtRQUM1RSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxXQUFXLENBQUMsR0FBRztZQUN0QixVQUFVLEVBQUUsc0JBQXNCO1lBQ2xDLFdBQVcsRUFDVCw4RkFBOEY7U0FDakcsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsT0FBTyxDQUFDLFlBQVk7WUFDM0IsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxRQUFRLENBQUMsWUFBWTtZQUM1QixXQUFXLEVBQUUsZ0NBQWdDO1NBQzlDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxFRCx3Q0FrRUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8qKlxuICogSXB0dlByb3h5U3RhY2tcbiAqXG4gKiBDcmlhIHVtYSBMYW1iZGEgRnVuY3Rpb24gVVJMIHDDumJsaWNhIHBhcmEgYSBBUEkgSVBUViBTYW1zdW5nLlxuICogUmVnacOjbzogY2EtY2VudHJhbC0xIChkZWZpbmlkYSBubyBiaW4vaXB0di1wcm94eS50cykuXG4gKlxuICogRW5kcG9pbnRzIHNlcnZpZG9zOlxuICogICAvYXBpL2hlYWx0aCwgL2FwaS9saXZlL2NhdGFsb2csIC9hcGkvdm9kL21vdmllcy9jYXRhbG9nLFxuICogICAvYXBpL3ZvZC9zZXJpZXMvY2F0YWxvZywgL2FwaS92b2QvbW92aWVzL2luZm8sIC9hcGkvdm9kL3Nlcmllcy9pbmZvLFxuICogICAvYXBpL3Byb3h5XG4gKi9cbmV4cG9ydCBjbGFzcyBJcHR2UHJveHlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIExBTUJEQV9QVUJMSUNfQkFTRTogcGFzc2FkbyB2aWEgY29udGV4dG8gQ0RLIGFww7NzIG8gMS7CuiBkZXBsb3kgKHBhcmEgcmVlc2NyaXRhIGRlIE0zVTgpXG4gICAgY29uc3QgbGFtYmRhUHVibGljQmFzZSA9IChcbiAgICAgICh0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnbGFtYmRhUHVibGljQmFzZScpIGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJydcbiAgICApLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBMb2cgR3JvdXAg4oCUIHJldGVuw6fDo28gZGUgMzAgZGlhc1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdJcHR2UHJveHlMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvbGFtYmRhL2lwdHYtcHJveHktZm4nLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgcHJveHlGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0lwdHZQcm94eUZuJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnaXB0di1wcm94eS1mbicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBJUFRWIFNhbXN1bmcg4oCUIGNhdMOhbG9nbyBMaXZlL1ZPRCwgcHJveHkgWHRyZWFtIChGdW5jdGlvbiBVUkwpJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgLy8gQXBvbnRhIHBhcmEgYXdzLXByb3h5L2xhbWJkYS8gKG9uZGUgb3MgbcOzZHVsb3Mgc8OjbyBjb3BpYWRvcyBhbnRlcyBkbyBkZXBsb3kpXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2xhbWJkYScpKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDI5KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICBsb2dHcm91cCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5PREVfT1BUSU9OUzogJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyxcbiAgICAgICAgTEFNQkRBX1BVQkxJQ19CQVNFOiBsYW1iZGFQdWJsaWNCYXNlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb24gVVJMIOKAlCBww7pibGljYSwgc2VtIGF1dGVudGljYcOnw6NvIEFXUyBJQU1cbiAgICAvLyBSZXNwb25zZSBTdHJlYW1pbmc6IHBlcm1pdGUgcmVzcG9zdGFzIGF0w6kgMjAgTUIuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGZ1bmN0aW9uVXJsID0gcHJveHlGbi5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGludm9rZU1vZGU6IGxhbWJkYS5JbnZva2VNb2RlLlJFU1BPTlNFX1NUUkVBTSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBPdXRwdXRzXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJcHR2UHJveHlGdW5jdGlvblVybCcsIHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvblVybC51cmwsXG4gICAgICBleHBvcnROYW1lOiAnSXB0dlByb3h5RnVuY3Rpb25VcmwnLFxuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICdVUkwgZGEgTGFtYmRhIEZ1bmN0aW9uIOKAlCB1c2FyIGNvbW8gVklURV9IWUJSSURfQVBJX0JBU0VfVVJMIGUgVklURV9CQUNLRU5EX0FQSSBubyAuZW52LnRpemVuJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJcHR2UHJveHlGdW5jdGlvbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogcHJveHlGbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05vbWUgZGEgTGFtYmRhIEZ1bmN0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJcHR2UHJveHlMb2dHcm91cE5hbWUnLCB7XG4gICAgICB2YWx1ZTogbG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIExvZyBHcm91cCBkYSBMYW1iZGEnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=