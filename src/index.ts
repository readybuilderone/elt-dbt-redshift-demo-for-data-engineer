import * as cdk from '@aws-cdk/core';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as ecr from '@aws-cdk/aws-ecr';

export class DataOPS extends cdk.Construct{

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        const ecrRepo = new ecr.Repository(this, 'elt-dbt-repo', {
            repositoryName: 'elt-dbt-repo',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        ecrRepo.repositoryUri

        const repo = new codecommit.Repository(this, 'elt-dbt-demo-repo', {
            repositoryName: 'elt-dbt-demo-repo',
            description: 'ELT with DBT Demo Repo'
        });

        const codeProject = new codebuild.Project(this, 'elt-dbt-code-build', {
            projectName: 'elt-dbt-code-build',
            source: codebuild.Source.codeCommit({repository: repo}),
            environment: {
                privileged: true,
            },
            environmentVariables: {
                'ECR_REPO_URI': {
                    value: `${ecrRepo.repositoryUri}`
                }
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            'echo logging into ECR',
                            '$(aws ecr get-login --no-include-email --region $AWS_DEFAULT_REGION)',
                            'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
                            'npm install -g aws-cdk',
                            'npm update'],
                    },
                    build: {
                        commands: ['echo Entered the build phase for dbt...', 
                        `docker build -t $ECR_REPO_URI:$TAG images/dbt/`],
                    },
                    post_build: {
                        commands: ['echo Pushing dbt docker image...', 
                        `docker push $ECR_REPO_URI:$TAG`],
                    }
                },
              }),
        });



        ecrRepo.grantPullPush(codeProject.role!);

    
    }
}