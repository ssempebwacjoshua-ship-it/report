import { Router } from "express";
import { verifyToken } from "../services/authService";
import { resolveNfcCredentialToken } from "../services/nfcCredentialTokenService";

function authPayloadFromHeader(authHeader: string | undefined) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return token ? verifyToken(token) : null;
}

export function nfcRoutes() {
  const router = Router();

  router.get("/api/nfc/t/:token", async (req, res, next) => {
    try {
      const auth = authPayloadFromHeader(req.headers.authorization);
      const result = await resolveNfcCredentialToken(req.params.token, auth);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
