#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { IptvProxyStack } from '../lib/iptv-proxy-stack';

const app = new cdk.App();

new IptvProxyStack(app, 'IptvProxyStack', {
  stackName: 'iptv-proxy-stack',
  env: {
    region: 'ca-central-1',
  },
  tags: {
    Project: 'IPTV',
    ManagedBy: 'CDK',
  },
});
