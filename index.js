const Core = require('@alicloud/pop-core');
const os = require('os');
const config = require('./config');
const colors = require('colors');

const {
    hostNames
} = config;

// 获取本地IP
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
    let originIp = '';

    await client.request(describeSubParams.Action, describeSubParams, requestOption).then((result) => {

        result.DomainRecords.Record
            .filter(record => record.RR === updateParmas.RR)
            .forEach(record => {
                shouldAdd = false;
                if (record.Value !== updateParmas.Value) {
                    shouldUpdate = true;
                    originIp = record.Value;
                    updateParmas.RecordId = record.RecordId;
                }
            });
    }, (ex) => {
        console.log(ex);
    });

    if (shouldUpdate) {
        await client.request(updateParmas.Action, updateParmas, requestOption).then((result) => {
            cb('Update success!', 'green', originIp, updateParmas.Value);
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
        cb('no update');
    }
}

const ipCheck = (ipAddress) => {
    return /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ipAddress) && ipAddress  || '';
}

for (let hostname of hostNames) {
    let target = {
        hostname: hostname.host,
        address: ipCheck(hostname.ip) || address
    };
    DDNS(target, (msg, color, originIp, upIp) => {
        console.log(`${new Date()} ==>  ${target.hostname} ==> ${msg} ${(originIp && `&& ` + originIp + ` ==To==> ` + upIp) || ''}`)
    });
}