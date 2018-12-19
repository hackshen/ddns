const Core = require('@alicloud/pop-core');
const os = require('os');
const config = require('./config.json');

const {
    hostNames
} = config;

const Interfaces = os.networkInterfaces();
let address = null;
for (let i = 0; i < Interfaces.en0.length; i++) {
    if (Interfaces.en0[i]['address'] && !/.*[a-z]+.*/g.test(Interfaces.en0[i]['address'])) {
        address = Interfaces.en0[i]['address'];
    }
}

const client = new Core({
    accessKeyId: config.AccessKeyId,
    accessKeySecret: config.AccessKeySecret,
    endpoint: 'https://alidns.aliyuncs.com',
    apiVersion: '2015-01-09'
});

const DDNS = async (target, cb) => {
    const ADDRESS = target.address;
    const SUBDOMAIN = target.hostname;
    const DOMAINNAME = SUBDOMAIN.split('.').slice(-2).join('.');
    const RR = SUBDOMAIN.split('.').slice(0, -2).join('.');
    const updateParmas = {
        Action: 'UpdateDomainRecord',
        RecordId: '',
        RR: RR,
        Type: 'A',
        Value: ADDRESS
    }

    const addParmas = {
        Action: 'AddDomainRecord',
        DomainName: DOMAINNAME,
        RR: RR,
        Type: 'A',
        Value: ADDRESS
    }

    const describeSubParams = {
        Action: 'DescribeSubDomainRecords',
        SubDomain: SUBDOMAIN
    }

    const requestOption = {
        method: 'POST'
    };

    let shouldUpdate = false;
    let shouldAdd = true;

    await client.request(describeSubParams.Action, describeSubParams, requestOption).then((result) => {

        result.DomainRecords.Record
            .filter(record => record.RR === updateParmas.RR)
            .forEach(record => {
                shouldAdd = false;
                if (record.Value !== updateParmas.Value) {
                    shouldUpdate = true;
                    updateParmas.RecordId = record.RecordId;
                }
            });
    }, (ex) => {
        console.log(ex);
    });

    if (shouldUpdate) {
        await client.request(updateParmas.Action, updateParmas, requestOption).then((result) => {
            cb('Update success!');
        }, (ex) => {
            console.log(ex);
        });
    }

    if (shouldAdd) {
        await client.request(addParmas.Action, addParmas, requestOption).then((result) => {
            cb('add success!');
        }, (ex) => {
            console.log(ex);
        });
    }

    if (!shouldAdd && !shouldUpdate) {
        cb('无更新');
    }
}

for (let hostname of hostNames) {
    let target = {
        hostname: hostname,
        address: address
    };
    DDNS(target, (msg) => {
        console.log(`${new Date()} ==>  ${target.hostname} ==> ${msg}`)
    });
}