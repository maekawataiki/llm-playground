import * as sagemaker from '@aws-cdk/aws-sagemaker-alpha';

export type Model = {
  name: string;
  // path: string;
  prompt_template_name: string;
  instanceType: sagemaker.InstanceType;
  model_data?: string;
  environment: {
    HF_MODEL_ID: string;
    MODEL_CACHE_ROOT?: string;
    SM_NUM_GPUS?: string;
    DTYPE?: string;
    MAX_INPUT_LENGTH?: string;
    MAX_TOTAL_TOKENS?: string;
    MAX_BATCH_TOTAL_TOKENS?: string;
  }
};

export type PromptTemplate = {
  prefix: string;
  suffix: string;
  join: string;
  user: string;
  assistant: string;
  system: string;
  eos_token: string;
};
