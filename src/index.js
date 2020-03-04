import bunyan, { stdSerializers } from 'bunyan';

let logger = null;

const proxy = new Proxy(
  {},
  {
    get(target, name, receiver) {
      if (!logger) throw new Error('Logger has not been initialized yet: run createLogger() first');
      return logger[name];
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

export const createLogger = ({ name, version = '' } = {}) => {
  if (!name) throw new Error('A name must be specified for the logger');
  logger = bunyan.createLogger({
    name: `${name}${version ? `@${version}` : ''}`,
    serializers
  });
  return logger;
};

export default proxy;
