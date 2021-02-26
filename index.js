// Load the SDK and UUID
require('dotenv').config();
var AWS = require('aws-sdk');
var iam = new AWS.IAM({apiVersion: '2010-05-08'});
const createInstanceProfile = async () => {
	try {
		console.log(`Create an Instance Profile ${process.env.EC2_ROLE_NAME} ...`);
		await iam.createInstanceProfile({InstanceProfileName: process.env.EC2_ROLE_NAME}).promise();
	} catch (err) {
		if (err.statusCode == "409") {
			console.log(err.code);
		} else {
			throw err;
		}
	}
};

const createIamRole = async () => {
	try {
		var doc = {
		        "Version": "2012-10-17",
		        "Statement": [
		                {
		                        "Effect": "Allow",
		                        "Principal": {
		                                "Service": "ec2.amazonaws.com"
		                        },
		                        "Action": "sts:AssumeRole"
		                }
		        ]
		};
		var params = {
			AssumeRolePolicyDocument: JSON.stringify(doc), 
			Path: "/", 
			RoleName: process.env.EC2_ROLE_NAME
		};
		console.log(`Create a Role ${process.env.EC2_ROLE_NAME} ...`);
		await iam.createRole(params).promise();
		console.log(`Attach role policy...`);
		await iam.attachRolePolicy({RoleName: process.env.EC2_ROLE_NAME, PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"}).promise();
		console.log(`Add Role To Instance Profile...`);
		await iam.addRoleToInstanceProfile({InstanceProfileName: process.env.EC2_ROLE_NAME, RoleName: process.env.EC2_ROLE_NAME}).promise();
	} catch (err) {
		if (err.statusCode == "409") {
			console.log(err.code);
		} else {
			throw err;
		}
	}
};

const createEnvironment = async () => {
	const c9 = new AWS.Cloud9({apiVersion: '2017-09-23'});
	let environmentId = null;
	const environments = await c9.listEnvironments().promise();
	if (environments.environmentIds.length == 0) {
		console.log(`Create Cloud9 Environment ${process.env.ENVIRONMENT_NAME} ...`);
		const ret = await c9.createEnvironmentEC2({
			name: process.env.ENVIRONMENT_NAME, 
			automaticStopTimeMinutes: 60, 
			instanceType: "t2.micro", 
			ownerArn: process.env.OWNER_ARN,
			subnetId: process.env.SUBNET_ID
		}).promise();
		environmentId = ret.environmentId;
	} else if (environments.environmentIds.length > 0) {
		console.log(`Finding Cloud9 Environment ${process.env.ENVIRONMENT_NAME}...`);
		for (let id of environments.environmentIds) {
			const env = await c9.describeEnvironments({ "environmentIds": [ id ] }).promise();
			if (env.environments[0].name == process.env.ENVIRONMENT_NAME) {
				environmentId = env.environments[0].id;
			}
			break;
		}
	}
	console.log(`environmentId: ${environmentId}`);
	return environmentId;
};

function sleep(msec) {
	return new Promise(function(resolve) {
		setTimeout(function() {resolve()}, msec);
	});
}

const waitForCreateInstance = async (environmentId) => {
	const instanceName = `aws-cloud9-${process.env.ENVIRONMENT_NAME}-${environmentId}`;
	console.log(instanceName);
	const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
	var params = {
		Filters: [
			{
				Name: "tag-key", 
				Values: ["Name"]
			},
			{
				Name: "tag-value",
				Values: [instanceName]
			}
		]
	};
	while(true) {
		const instances = await ec2.describeInstances(params).promise();
		if ((instances.Reservations.length > 0) && (instances.Reservations[0].Instances.length > 0) && instances.Reservations[0].Instances[0].State.Name == 'running') {
			console.log(`Ready. instance ${instances.Reservations[0].Instances[0].InstanceId}, State is ${instances.Reservations[0].Instances[0].State.Name}`);
			return instances.Reservations[0].Instances[0].InstanceId;
		}
		console.log(`Wait for instance up...`);
		await sleep(5000);
	}
};

const associateIamInstanceProfile = async (instanceId, instanceProfileName) => {
	try {
		const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
		console.log(`associateIamInstanceProfile: ${instanceId}, ${instanceProfileName}`);
		const ret = await ec2.associateIamInstanceProfile({InstanceId: instanceId, IamInstanceProfile: {Name: instanceProfileName}}).promise();
	} catch (err) {
		if (err.statusCode == "400") {
			console.log(err.message);
		} else {
			throw err;
		}
	}
};

const describeVolumes = async (instanceId) => {
	const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
	console.log(`Describe volume ${instanceId}...`);
	const ret = await ec2.describeVolumes({Filters: [{Name: "attachment.instance-id", Values: [instanceId]}]}).promise();
	const volumeId = ret.Volumes[0].VolumeId;
	console.log(`volumeId: ${volumeId}`);
	return volumeId;
};

const modifyVolume = async (volumeId) => {
	const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
	console.log(`Modofy volume ${volumeId} to ${process.env.VOLUME_SIZE_GB}...`);
	const ret = await ec2.modifyVolume({Size: process.env.VOLUME_SIZE_GB, VolumeId: volumeId}).promise();
	console.log(ret);
};

const run = async () => {
	console.log(`Start...`);
	// インスタンスプロファイル作成
	await createInstanceProfile();
	// IAMロール作成
	await createIamRole();
	// Cloud9環境作成
	const environmentId = await createEnvironment();
	// Cloud9環境起動待ち(=EC2インスタンスID取得)
	const instanceId = await waitForCreateInstance(environmentId);
	// EC2インスタンスに割り当てられているEBSボリュームID取得
	const volumeId = await describeVolumes(instanceId);
	// EBSのサイズ変更
	await modifyVolume(volumeId);
	// EC2インスタンスにインスタンスプロファイル割当
	await associateIamInstanceProfile(instanceId, process.env.EC2_ROLE_NAME);
	console.log(`Finish successfully!`);
};
run();
