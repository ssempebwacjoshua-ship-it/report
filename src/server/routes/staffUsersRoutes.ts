import { Router } from "express";
import { z } from "zod";
import {
  changeStaffRole,
  createStaffUser,
  listStaffUsers,
  resetStaffPassword,
  setStaffStatus,
} from "../services/staffUsersService";
import type { AuthPayload } from "../services/authService";
import { requireSchoolPermission } from "../middleware/requireSchoolPermission";

const ALLOWED_ROLES = ["ADMIN_OPERATOR", "GATE_SECURITY", "SECURITY", "CANTEEN", "CASHIER"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
  phone: z.string().trim().optional(),
  role: z.enum(ALLOWED_ROLES),
  temporaryPassword: z.string().min(10, "Temporary password must be at least 10 characters."),
});

const changeRoleSchema = z.object({
  role: z.enum(ALLOWED_ROLES),
  reason: z.string().trim().min(1, "Reason is required."),
});

const statusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(1, "Reason is required."),
});

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(10, "Temporary password must be at least 10 characters."),
  reason: z.string().trim().min(1, "Reason is required."),
});

function ctx(req: { school?: { id: string }; user?: AuthPayload }) {
  return {
    schoolId: req.school?.id,
    actorId: req.user?.userId,
    role: req.user?.role,
  };
}

export function staffUsersRoutes() {
  const router = Router();
  router.use(requireSchoolPermission("staff.manage"));

  router.get("/api/staff-users", async (req, res, next) => {
    try {
      res.json(await listStaffUsers(ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/staff-users", async (req, res, next) => {
    try {
      res.status(201).json(await createStaffUser(ctx(req), createSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/staff-users/:id/role", async (req, res, next) => {
    try {
      res.json(await changeStaffRole(ctx(req), req.params.id, changeRoleSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/staff-users/:id/status", async (req, res, next) => {
    try {
      res.json(await setStaffStatus(ctx(req), req.params.id, statusSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/staff-users/:id/reset-password", async (req, res, next) => {
    try {
      res.json(await resetStaffPassword(ctx(req), req.params.id, resetPasswordSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
