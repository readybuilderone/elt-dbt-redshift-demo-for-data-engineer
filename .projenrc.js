const { AwsCdkTypeScriptApp } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.95.2',
  defaultReleaseBranch: 'main',
  name: 'elt-dbt-demo-for-redshift',
  cdkDependencies: [
    '@aws-cdk/aws-codecommit',
    '@aws-cdk/aws-codepipeline-actions',
    '@aws-cdk/aws-codebuild',
    '@aws-cdk/aws-ecr',
  ],
  context: {
    '@aws-cdk/core:newStyleStackSynthesis':true,
  }
});
project.synth();