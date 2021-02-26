Cloud9 Autoprovision
===

## 概要
コマンドラインでCloud9環境を作成し、インスタンスプロファイルを割り当てる。
必要なインスタンスプロファイルやIAMロールなども存在しない場合は作成する。
最後にEBSのサイズ変更を行う。

## 利用方法

`node index.js` を実行すると最終的にボリュームサイズの変更処理を呼び出して終了します。
ボリュームサイズが変更されるまでは1時間程度かかることもあるので完了するまでお待ちください。
状況はAWSの[EBSコンソール](https://ap-northeast-1.console.aws.amazon.com/ec2/v2/home?region=ap-northeast-1#Volumes:sort=desc:createTime)で確認します。

```
$ git clone リポジトリURL
$ cd リポジトリディレクトリ
$ npm install
$ cp .env.example .env
.env ファイルを編集

EC2_ROLE_NAME: Cloud9環境のインスタンスに割り当てるロール名（通常は変更不要)
ENVIRONMENT_NAME: Cloud9環境名（通常は変更不要)
VOLUME_SIZE_GB: ボリュームサーズ(GB)
IAM_USER_ARN: Cloud9環境のオーナーのIAMユーザのARN(環境に合わせて変更が必要)
SUBNET_ID: Cloud9環境を作成するサブネットID（環境に合わせて変更が必要)

$ node index.js
Start...
Create an Instance Profile EC2RoleForCloud9 ...
EntityAlreadyExists
Create a Role EC2RoleForCloud9 ...
EntityAlreadyExists
Create Cloud9 Environment basic-dev ...
environmentId: xxxxxxxxxxxxxxxxxxx
aws-cloud9-basic-dev-xxxxxxxxxxxxxxxxxxxxx
Wait for instance up...
Wait for instance up...
Wait for instance up...
Wait for instance up...
Wait for instance up...
Wait for instance up...
Wait for instance up...
Ready. instance i-xxxxxxxxxxxxxxxxxxxxx, State is running
Describe volume i-xxxxxxxxxxxxxxxxxxxxx...
volumeId: vol-xxxxxxxxxxxxx
Modofy volume vol-xxxxxxxxxxxxx to 16...
{
  VolumeModification: {
    VolumeId: 'vol-xxxxxxxxxxxxxxx',
    ModificationState: 'modifying',
    TargetSize: 16,
    TargetIops: 100,
    TargetVolumeType: 'gp2',
    OriginalSize: 10,
    OriginalIops: 100,
    OriginalVolumeType: 'gp2',
    Progress: 0,
    StartTime: 2021-02-26T15:14:00.000Z
  }
}
associateIamInstanceProfile: i-xxxxxxxxxxxxxxxx, EC2RoleForCloud9
Finish successfully!
```
