#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MetricStreams } from "../lib/newrelic-streams-infra";

const app = new cdk.App();
const bucketName = String(app.node.tryGetContext("BACKUP_BUCKET_NAME"));
const newrelicSecretArn = String(app.node.tryGetContext("NR_SECRET_ARN"));

const stack = new MetricStreams(app, `NewRelicMetricStreamInfra`, {
  bucketName: bucketName,
  newrelicSecretArn: newrelicSecretArn,
});

