import { StackProps } from "aws-cdk-lib";

export interface IConfig {
  [env: string]: INewRelicInfraProps;
}

export interface INewRelicInfraProps extends StackProps {
  bucketName: string;
  newrelicSecretArn: string;
}
