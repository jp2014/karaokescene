import { HTTPException } from 'hono/http-exception';

export const fail = (status: 400 | 401 | 403 | 404 | 409, message: string): never => {
  throw new HTTPException(status, { message });
};
export const notFound = (what: string) => fail(404, `${what} not found`);
