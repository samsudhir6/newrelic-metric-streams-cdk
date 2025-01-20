import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { CfnDeliveryStream } from "aws-cdk-lib/aws-kinesisfirehose";
import {
  Effect,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { CfnMetricStream } from "aws-cdk-lib/aws-cloudwatch";
import { LogGroup, LogStream, RetentionDays } from "aws-cdk-lib/aws-logs";
import { INewRelicInfraProps } from "./newrelic-streams-base";
import { Secret as SecretsManagerSecret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Secret,
} from "aws-cdk-lib/aws-ecs";

export class MetricStreams extends Stack {
  private props: INewRelicInfraProps;

  constructor(scope: Construct, id: string, props: INewRelicInfraProps) {
    super(scope, id, props);

    this.props = props;

    //Create an S3 bucket to store data that failed to be sent to New relic
    const bucket = new Bucket(this, "S3Bucket", {
      bucketName: props.bucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    //Kinesis IAM Role
    const firehoseRole = new Role(this, "FirehoseRole", {
      assumedBy: new ServicePrincipal("firehose.amazonaws.com"),
      roleName: `new-relic-metric-streams-integration-role`,
    });

    //Log group and Log stream for Kinesis Data Firehose
    const logGroup = new LogGroup(this, "LogGroup", {
      logGroupName: `new-relic-metric-streams-integration`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.THREE_MONTHS,
    });

    const logStream = new LogStream(this, "LogStream", {
      logGroup: logGroup,
      // the properties below are optional
      logStreamName: `newrelic-delivery-stream`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    firehoseRole.attachInlinePolicy(
      new Policy(this, "S3Policy", {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "s3:AbortMultipartUpload",
              "s3:GetBucketLocation",
              "s3:GetObject",
              "s3:ListBucket",
              "s3:ListBucketMultipartUploads",
              "s3:PutObject",
            ],
            resources: [`${bucket.bucketArn}`, `${bucket.bucketArn}/*`],
          }),
        ],
      })
    );

    firehoseRole.attachInlinePolicy(
      new Policy(this, "CloudwatchPolicy", {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "logs:PutLogEvents"
            ],
            resources: [`*`],
          }),
        ],
      })
    );

    //Retrieve license key secret ARN from secrets manager
    const newRelicLicenseKeyName = SecretsManagerSecret.fromSecretCompleteArn(
      this,
      "NRLicenseKey",
      `${props.newrelicSecretArn}`
    );

    //Create the Kinesis delivery stream
    const firehoseStreamToNewRelic = new CfnDeliveryStream(
      this,
      "FirehoseStreamToNewRelic",
      {
        deliveryStreamName: "new-relic-delivery-stream",
        deliveryStreamType: "DirectPut",
        httpEndpointDestinationConfiguration: {
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: logGroup.logGroupName,
            logStreamName: logStream.logStreamName,
          },
          requestConfiguration: {
            contentEncoding: "GZIP",
          },
          endpointConfiguration: {
            name: "New Relic",
            url: "https://aws-api.newrelic.com/cloudwatch-metrics/v1",
            accessKey: newRelicLicenseKeyName.secretValue.unsafeUnwrap(),
          },
          bufferingHints: {
            intervalInSeconds: 60,
            sizeInMBs: 1,
          },
          retryOptions: {
            durationInSeconds: 60,
          },
          s3Configuration: {
            compressionFormat: "UNCOMPRESSED",
            prefix: "delivery",
            errorOutputPrefix: "error",
            bucketArn: bucket.bucketArn,
            roleArn: firehoseRole.roleArn,
          },
          s3BackupMode: "FailedDataOnly",
          roleArn: firehoseRole.roleArn,
        },
      }
    );

    const metricStreamRole = new Role(this, "MetricStreamRole", {
      assumedBy: new ServicePrincipal(
        "streams.metrics.cloudwatch.amazonaws.com"
      ),
      roleName: `cloudwatch-metric-streams-role`,
    });

    metricStreamRole.attachInlinePolicy(
      new Policy(this, "Policy", {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["firehose:PutRecord", "firehose:PutRecordBatch"],
            resources: [firehoseStreamToNewRelic.attrArn],
          }),
        ],
      })
    );

    //Create the cloudwatch metric stream
    const cloudWatchMetricStream = new CfnMetricStream(
      this,
      "CloudWatchMetricStream",
      {
        name: "new-relic-metric-stream",
        firehoseArn: firehoseStreamToNewRelic.attrArn,
        roleArn: metricStreamRole.roleArn,
        outputFormat: "opentelemetry0.7",
        includeFilters: [
          {
            namespace: "AWS/NetworkELB",
          },
          {
            namespace: "AWS/ApplicationELB",
          },
          {
            namespace: "AWS/ApiGateway",
          },
          {
            namespace: "AWS/ECS",
          },
          {
            namespace: "AWS/Cognito",
          },
          {
            namespace: "AWS/DynamoDB",
          },
          {
            namespace: "AWS/Lambda",
          },
          {
            namespace: "AWS/SQS",
          },
          {
            namespace: "AWS/ElastiCache",
          },
          //Add to this list if more namespaces are required to be included
        ],
      }
    );

    new CfnOutput(this, "KinesisDataFirehoseArn", {
      key: 'KinesisDataFirehoseArn',
      value: firehoseStreamToNewRelic.attrArn,
      exportName: 'KinesisDataFirehoseArn',
      description: "Kinesis Data Firehose ARN",
    });


    new CfnOutput(this, "CloudwatchMetricStreamArn", {
      key: 'CloudwatchMetricStreamArn',
      value: cloudWatchMetricStream.attrArn,
      exportName: 'CloudwatchMetricStreamArn',
      description: "Cloudwatch Metric Stream ARN",
    });
  }
  
}
