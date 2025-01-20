# Introduction 
This repo is for creating the infrastructure for the New relic cloudwatch metric streams integration.

# Resources created 
1. Kinesis Data Firehose
2. Cloudwatch Metric Stream
3. S3 bucket for logging
4. IAM Roles
5. Cloudwatch Log groups

# Pre-requisites

## IAM Role Creation for New relic
Follow the steps (2) and (3) in `https://newrelic.com/blog/how-to-relic/cloudwatch-metric-streams-insights` to create the integration role. 

## New Relic License Key
Kinesis Data Fireshose requires a new relic license key to push metric to new relic. The License Key should be created in new relic and stored as a secret in AWS Secrets Manager. This will be refereced using the Secret ARN.


# Build and Test
Run `npm install` to install dependencies.
Run `npm run test` to initiate unit test cases for CDK Constructs

# Synthesizing CDK Template
`cdk synth` synthesizes the CDK app into a cloudformation template. Running `cdk synth -c BACKUP_BUCKET_NAME="<backup-bucket-name" -c NR_SECRET_ARN="<Secret ARN of the new relic secret in secrets manager"` will result in a cdk.out folder being created with a cloudformation template.

# Deploying CDK
`cdk deploy` deploys the CDK app to the AWS Account specified in `bin/index.ts`
`cdk deploy -c BACKUP_BUCKET_NAME="<backup-bucket-name" -c NR_SECRET_ARN="<Secret ARN of the new relic secret in secrets manager"`

The `cdk.json` file tells the CDK Toolkit how to execute your app.

# Useful commands
* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`  deploy this stack to your default AWS account/region
* `cdk diff`    compare deployed stack with current state