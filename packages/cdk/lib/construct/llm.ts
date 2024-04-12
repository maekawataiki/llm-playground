import { Construct } from 'constructs';
import * as sagemaker from '@aws-cdk/aws-sagemaker-alpha';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Model } from 'generative-ai-use-cases-jp';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';


const models: Model[] = [
  // {
  //   name: 'llm-jp-13b-instruct-full-jaster-dolly-oasst-v1',
  //   path: 'models/llm-jp-13b-instruct-full-jaster-dolly-oasst-v1.0.tar.gz',
  //   prompt_template_name: 'llmJp',
  //   instanceType: sagemaker.InstanceType.G5_2XLARGE
  // },
  // {
  //   name: 'llm-jp-13b-instruct-lora-jaster-dolly-oasst-v1',
  //   path: 'models/llm-jp-13b-instruct-lora-jaster-dolly-oasst-v1.0.tar.gz',
  //   prompt_template_name: 'llmJp',
  //   instanceType: sagemaker.InstanceType.G5_2XLARGE
  // },
  {
    name: 'elyza',
    prompt_template_name: 'llama2',
    instanceType: sagemaker.InstanceType.G5_2XLARGE,
    environment: {
      HF_MODEL_ID: 'elyza/ELYZA-japanese-Llama-2-7b-instruct',
      SM_NUM_GPUS: '1',
      DTYPE: 'bfloat16',
      MAX_INPUT_LENGTH: "2048",
      MAX_TOTAL_TOKENS: "4096",
      MAX_BATCH_TOTAL_TOKENS: "8192",
    }
  },
  {
    name: 'elyza-s3',
    prompt_template_name: 'llama2',
    instanceType: sagemaker.InstanceType.G5_2XLARGE,
    model_data: 's3://sagemaker-ap-northeast-1-867115166077/models/elyza.tar.gz',
    environment: {
      HF_MODEL_ID: '/opt/ml/model',
      MODEL_CACHE_ROOT: "/opt/ml/model",
      SM_NUM_GPUS: '1',
      DTYPE: 'bfloat16',
      MAX_INPUT_LENGTH: "2048",
      MAX_TOTAL_TOKENS: "4096",
      MAX_BATCH_TOTAL_TOKENS: "8192",
    }
  },
];

export class LLM extends Construct {
  public readonly models: Model[] = models;
  public readonly deploy_suffix: string =
    '-' + new Date().toISOString().replace(/[:T-]/g, '').split('.')[0];
  public readonly endpointConfigName;
  public readonly endpointName;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Specify Endpoint with stage suffix
    const stage = this.node.tryGetContext('stage');
    const prefix = stage ? `${stage}-` : '';
    this.endpointConfigName = prefix + 'llm-jp-endpoint-config' + this.deploy_suffix;
    this.endpointName = prefix + 'llm-jp-endpoint';

    // Get Container Image
    // https://github.com/aws/deep-learning-containers/blob/master/available_images.md
    const repositoryName = 'huggingface-pytorch-tgi-inference';
    const tag = '2.1.1-tgi1.4.5-gpu-py310-cu121-ubuntu22.04';
    const image = sagemaker.ContainerImage.fromDlc(repositoryName, tag);

    // Create Models
    const s3Policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:GetBucket*',
        's3:GetObject*',
        's3:List*'
      ],
      resources: [
        `arn:aws:s3:::sagemaker-ap-northeast-1-867115166077/`,
        `arn:aws:s3:::sagemaker-ap-northeast-1-867115166077/*`
      ],
    });
    const sm_models = models.map((model, idx) => {
      // const modelData = sagemaker.ModelData.fromAsset(model.path);
      let modelData = undefined;
      if (model.model_data) {
        const bucketName = model.model_data.split('/')[2]
        const bucket = s3.Bucket.fromBucketName(this, bucketName + idx, bucketName);
        const key = '/' + model.model_data.split('/').slice(3).join('/')
        modelData = sagemaker.ModelData.fromBucket(bucket, key);
      }
      const sm_model = new sagemaker.Model(
        this,
        `sagemaker-model-${model.name}`,
        {
          modelName: model.name + this.deploy_suffix,
          containers: [
            {
              image: image,
              modelData: modelData,
              environment: model.environment,
            },
          ],
        }
      );
      sm_model.addToRolePolicy(s3Policy)
      return sm_model;
    });

    // Create Endpoint Config
    const endpointConfig = new sagemaker.EndpointConfig(
      this,
      'EndpointConfig',
      {
        endpointConfigName: this.endpointConfigName,
        instanceProductionVariants: models.map((modelConfig, idx) => {
          return {
            model: sm_models[idx],
            variantName: modelConfig.name,
            initialVariantWeight: 1,
            initialInstanceCount: 1,
            instanceType: sagemaker.InstanceType.G5_2XLARGE,
          };
        }),
      }
    );
    sm_models.forEach((sm_model) =>
      endpointConfig.node.addDependency(sm_model)
    );
  }
}
