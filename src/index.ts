import * as cdk from '@aws-cdk/core';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as ecr from '@aws-cdk/aws-ecr';
import * as targets from '@aws-cdk/aws-events-targets';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as redshift from '@aws-cdk/aws-redshift';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as mwaa from '@aws-cdk/aws-mwaa';

export class DataOPS extends cdk.Construct{
    private readonly RedshiftUser ='redshift-user';
    private readonly RedshiftDB ='redshift-db';
    private readonly RedshiftSchema='public';
    private readonly ECRRepoName = 'elt-dbt-repo';

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        const vpc = this._createVPC();

        const ecrRepo = this._createECRRepo();
        this._createDataOPSPipeline(ecrRepo);
        
        const redshiftSecret = this._createRedshiftSecret();
        const redshiftCluster = this._createRedshiftCluster(vpc, redshiftSecret);
        
        this._createECSResources(vpc, ecrRepo, redshiftCluster, redshiftSecret);

        const airflowBucket = this._getAirflowBucket();
        new cdk.CfnOutput(this, 'AirflowBucketName', {
            value: airflowBucket.bucketName,
        });

        new mwaa.CfnEnvironment(this, 'id', {
            name: 'airflow'
        });
        //https://github.com/094459/blogpost-cdk-mwaa/blob/main/mwaa_cdk/mwaa_cdk_env.py
    }

    private _createECSResources(vpc: ec2.Vpc, ecrRepo: ecr.Repository, redshiftCluster: redshift.ICluster, redshiftSecret: secretsmanager.Secret) {
        const ecsCluster = new ecs.Cluster(this, 'dataops-ecs-cluster', {
            vpc,
            clusterName: 'dataops-ecs-cluster',
            containerInsights: true,
        });
        new cdk.CfnOutput(this, 'EcsClusterName', {
            value: ecsCluster.clusterName,
        });

        const executionRole = this._createTaskExecutionRole();
        const dataopsTaskDefinition = new ecs.FargateTaskDefinition(this, 'dataops-task-def', {
            family: 'dataops-task',
            cpu: 512,
            memoryLimitMiB: 1024,
            executionRole,
            taskRole: this._createTaskRole(),
        });
        new cdk.CfnOutput(this, 'TaskDefinition', {
            value: dataopsTaskDefinition.family,
        });

        vpc.privateSubnets.forEach(subnet => {
            new cdk.CfnOutput(this, subnet.availabilityZone + '-SubnetId', {
                value: subnet.subnetId,
            });
        });

        dataopsTaskDefinition.addContainer('dataops-container', {
            image: ecs.AssetImage.fromEcrRepository(ecrRepo),
            environment: {
                'REDSHIFT_HOST': redshiftCluster.clusterEndpoint.hostname,
                'REDSHIFT_DBNAME': this.RedshiftDB,
                'REDSHIFT_SCHEMA': this.RedshiftSchema,
            },
            secrets: {
                'REDSHIFT_USER': ecs.Secret.fromSecretsManager(redshiftSecret, 'username'),
                'REDSHIFT_PASSWORD': ecs.Secret.fromSecretsManager(redshiftSecret, 'password'),
            },
            logging: new ecs.AwsLogDriver({
                streamPrefix: 'ecs',
            })
        });

        ecrRepo.grantPullPush(executionRole);
    }

    private _createVPC() {
        return new ec2.Vpc(this, 'dataops-vpc', {
            maxAzs: 2,
            natGateways: 1,
        });
    }

    private _createECRRepo() {
        return new ecr.Repository(this, 'elt-dbt-repo', {
            repositoryName: this.ECRRepoName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }

    private _createRedshiftSecret() {
        return new secretsmanager.Secret(this, 'redshift-credentials', {
            secretName: 'redshift-credentials',
            generateSecretString: {
                secretStringTemplate: '{"username":"redshift-user"}',
                generateStringKey: 'password',
                passwordLength: 32,
                excludeCharacters: '\"@/',
                excludePunctuation: true,
            },
        });
    }

    private _createTaskExecutionRole(): iam.Role {
        const executionRole = new iam.Role(this, 'AirflowTaskExecutionRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
    
        executionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));
        executionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
        return executionRole;
      }
    
      private _createTaskRole(): iam.Role {
        const taskRole = new iam.Role(this, 'AirflowTaskRole', {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        taskRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
 
    
        //Secrets Manager
        taskRole.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: ['*'],
        }));
    
        return taskRole;
      }

    private _getAirflowBucket(): s3.IBucket {
        const bucketName = `airflow-bucket-${Math.floor(Math.random() * 1000001)}`;
        const airflowBucket = new s3.Bucket(this, 'AirflowBucket', {
          bucketName,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          blockPublicAccess: new s3.BlockPublicAccess({
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
          }),
          autoDeleteObjects: true,
        });
        return airflowBucket;
      }

    private _createDataOPSPipeline(ecrRepo: ecr.IRepository) {
        

        const repo = new codecommit.Repository(this, 'elt-dbt-demo-repo', {
            repositoryName: 'elt-dbt-demo-repo',
            description: 'ELT with DBT Demo Repo'
        });


        const codeProject = new codebuild.Project(this, 'elt-dbt-code-build', {
            projectName: 'elt-dbt-code-build',
            source: codebuild.Source.codeCommit({ repository: repo }),
            environment: {
                privileged: true,
            },
            environmentVariables: {
                'ECR_REPO_URI': {
                    value: `${ecrRepo.repositoryUri}`
                },
                'IMAGE_REPO_NAME': {
                    value: `${ecrRepo.repositoryName}`
                },
                'IMAGE_TAG': {
                    value: 'latest'
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            'echo logging into ECR',
                            '$(aws ecr get-login --no-include-email --region $AWS_DEFAULT_REGION)',
                            'npm install -g aws-cdk',
                            'npm update'
                        ],
                    },
                    build: {
                        commands: ['echo Entered the build phase for dbt...',
                            `docker build -t $IMAGE_REPO_NAME images/`,
                            'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $ECR_REPO_URI:$IMAGE_TAG'],
                    },
                    post_build: {
                        commands: ['echo Pushing dbt docker image...',
                            `docker push $ECR_REPO_URI:$IMAGE_TAG`],
                    }
                },
            }),
        });

        ecrRepo.grantPullPush(codeProject.role!);

        repo.onCommit('onCommit', {
            target: new targets.CodeBuildProject(codeProject),
            branches: ['main'],
        });
    }

    private _createRedshiftCluster(vpc: ec2.IVpc, redshiftSecret: secretsmanager.ISecret): redshift.ICluster{
        const subnetGroup = new redshift.ClusterSubnetGroup(this, 'RedshiftSubnetGroup', {
            description: 'Redshift Private Subnet Group',
            vpc,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
        });



        const redshiftCluster = new redshift.Cluster(this, 'redshift-cluster', {
            vpc,
            masterUser: {
                masterUsername: this.RedshiftUser,
                masterPassword: redshiftSecret.secretValueFromJson('password'),
            },
            clusterName: 'redshift-cluster',
            clusterType: redshift.ClusterType.SINGLE_NODE,
            defaultDatabaseName: this.RedshiftDB,
            publiclyAccessible: true,
            subnetGroup,
        });

        redshiftCluster.connections.allowDefaultPortFromAnyIpv4('Just for Demo Purpose');
        return redshiftCluster;
    }
}