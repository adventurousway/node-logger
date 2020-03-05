import { hrtime } from 'process';

import bunyan, { stdSerializers } from 'bunyan';
import { v4 as uuid } from 'uuid';

let log = null;

const proxy = new Proxy(
  {},
  {
    get(target, name, receiver) {
      if (!log) throw new Error('log has not been initialized yet: run createLogger() first');
      return log[name];
    }
  }
);

const serializers = {
  request: request => ({
    method: request.method,
    url: request.url,
    headers: request.headers
  }),
  response: response => ({
    status: response.status,
    method: response.request.method,
    url: response.request.url,
    size: response.length,
    responseTime: response.responseTime,
    headers: response.headers
  }),
  err: stdSerializers.err
};

export const createLogger = ({ name, version = null, level = 'info' } = {}) => {
  if (!name) throw new Error('A name must be specified for the log');

  const fullName = `${name}${version ? `@${version}` : ''}`;
  log = bunyan.createLogger({
    name: fullName,
    serializers,
    stream: process.stdout,
    level,
    app: {
      name,
      version,
      fullName
    }
  });
  return log;
};

export const requestLogger = async (ctx, next) => {
  const startedAt = hrtime.bigint();
  const requestId = uuid();
  const correlationId = ctx.get('X-Correlation-ID') || uuid();

  if (log.fields.name) ctx.set('X-Powered-By', log.fields.name);

  ctx.set('X-Request-ID', requestId);
  ctx.set('X-Correlation-ID', correlationId);

  ctx.correlationId = correlationId;

  ctx.log = log.child({ requestId, correlationId });

  ctx.log.info({ request: ctx.request, requestId }, 'HTTP Request');

  await next();

  // eslint-disable-next-line no-undef
  const responseTime = Number((hrtime.bigint() - startedAt) / BigInt(1e6)) / 1e3;
  ctx.response.responseTime = responseTime;
  ctx.set('X-Response-Time', `${responseTime}`);

  ctx.log.info({ response: ctx.response }, 'HTTP Response');
};

export default proxy;
