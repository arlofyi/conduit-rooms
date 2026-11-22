import {
  API_PREFIX,
  HANDLE_MAX,
  HANDLE_MIN,
  PRODUCT_NAME_MAX_LENGTH,
  isValidHandle,
  slugifyHandle,
  uniqueHandle,
  type ProductResponse,
  type Project,
} from "@rooms/shared";
import { Hono } from "hono";
import { z } from "zod";
import { ensureDirectChats } from "../../store/directChats";
import { createProduct, removeProduct, renameProduct, setProductRepos } from "../../store/products";
import { allHandles, getProject, isHandleTaken } from "../../store/projects";
import type { AppContext } from "../context";
import { HttpError, invalid, notFound } from "../errors";

const name = z.string().trim().min(2, "Give the product a name.").max(PRODUCT_NAME_MAX_LENGTH);
const handle = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidHandle, `A handle is ${HANDLE_MIN} to ${HANDLE_MAX} characters: a to z, 0 to 9 and "-".`);
const repoIds = z.array(z.string());

const createBody = z.object({ name, handle: handle.optional(), repoIds: repoIds.default([]) });
const updateBody = z.object({ name: name.optional(), repoIds: repoIds.optional() });

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "Invalid request.");
  return parsed.data;
}

/**
 * Products: several repos under one name, with a lead of their own.
 *
 *   POST   /products       make one over the repos you chose
 *   PATCH  /products/:id   rename it, or change which repos are under it
 *   DELETE /products/:id   take it apart. Its repos stand on their own again.
 *
 * Once made, a product is listed by /projects and has a room like any project.
 */
export function productRoutes(ctx: AppContext): Hono {
  const app = new Hono();

  function requireProduct(productId: string): Project {
    const product = getProject(ctx.db, productId);
    if (product?.kind !== "product") throw notFound("That product");
    return product;
  }

  /** Only repos go under a product: not an agent, and not another product. */
  function requireRepos(ids: readonly string[]): void {
    const wrong = ids.find((id) => getProject(ctx.db, id)?.kind !== "project");
    if (wrong) throw invalid("One of those is not a project.");
  }

  function freeHandle(asked: string | undefined, productName: string): string {
    if (!asked) return uniqueHandle(slugifyHandle(productName), allHandles(ctx.db));
    if (isHandleTaken(ctx.db, asked)) throw new HttpError("conflict", `@${asked} is already taken.`);
    return asked;
  }

  app.post(`${API_PREFIX}/products`, async (c) => {
    const body = await parseBody(c.req.raw, createBody);
    requireRepos(body.repoIds);

    const product = createProduct(ctx.db, body.name, freeHandle(body.handle, body.name), body.repoIds);
    ensureDirectChats(ctx.db);

    return c.json<ProductResponse>({ product }, 201);
  });

  app.patch(`${API_PREFIX}/products/:productId`, async (c) => {
    const product = requireProduct(c.req.param("productId"));
    const body = await parseBody(c.req.raw, updateBody);

    if (body.name !== undefined) renameProduct(ctx.db, product.id, body.name);
    if (body.repoIds !== undefined) {
      requireRepos(body.repoIds);
      setProductRepos(ctx.db, product.id, body.repoIds);
    }

    return c.json<ProductResponse>({ product: requireProduct(product.id) });
  });

  app.delete(`${API_PREFIX}/products/:productId`, (c) => {
    removeProduct(ctx.db, requireProduct(c.req.param("productId")).id);
    return c.body(null, 204);
  });

  return app;
}
