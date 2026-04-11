#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = require("aws-cdk-lib");
const iptv_proxy_stack_1 = require("../lib/iptv-proxy-stack");
const app = new cdk.App();
new iptv_proxy_stack_1.IptvProxyStack(app, 'IptvProxyStack', {
    stackName: 'iptv-proxy-stack',
    env: {
        region: 'ca-central-1',
    },
    tags: {
        Project: 'IPTV',
        ManagedBy: 'CDK',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXB0di1wcm94eS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2Jpbi9pcHR2LXByb3h5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG1DQUFtQztBQUNuQyw4REFBeUQ7QUFFekQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsSUFBSSxpQ0FBYyxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRTtJQUN4QyxTQUFTLEVBQUUsa0JBQWtCO0lBQzdCLEdBQUcsRUFBRTtRQUNILE1BQU0sRUFBRSxjQUFjO0tBQ3ZCO0lBQ0QsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLE1BQU07UUFDZixTQUFTLEVBQUUsS0FBSztLQUNqQjtDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBJcHR2UHJveHlTdGFjayB9IGZyb20gJy4uL2xpYi9pcHR2LXByb3h5LXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxubmV3IElwdHZQcm94eVN0YWNrKGFwcCwgJ0lwdHZQcm94eVN0YWNrJywge1xuICBzdGFja05hbWU6ICdpcHR2LXByb3h5LXN0YWNrJyxcbiAgZW52OiB7XG4gICAgcmVnaW9uOiAnY2EtY2VudHJhbC0xJyxcbiAgfSxcbiAgdGFnczoge1xuICAgIFByb2plY3Q6ICdJUFRWJyxcbiAgICBNYW5hZ2VkQnk6ICdDREsnLFxuICB9LFxufSk7XG4iXX0=