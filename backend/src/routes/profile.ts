import { Router } from "express";
import { z } from "zod";
import { registrarLog } from "../audit";
import { run, tx, type Pool } from "../db";
import { HttpError } from "../http";
import { idParam, psicologoId, userId } from "../middleware/auth";
import { loadProfile } from "../profile";
import { nameField, optionalText } from "../users";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.");

const profileSchema = z.object({
  name: nameField,
  areaAtuacao: optionalText(120),
  bio: optionalText(2000),
  feeCents: z.number().int().min(0).max(10_000_000),
  availability: z
    .array(
      z
        .object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm })
        .refine((w) => w.start < w.end, "O horário final precisa ser depois do inicial."),
    )
    .max(40),
});

const educationSchema = z.object({
  kind: z.enum(["certificado", "curso"]),
  title: z.string().trim().min(2, "Informe o título.").max(160),
  institution: optionalText(160),
  year: z.number().int().min(1950).max(2100).nullish(),
});

/** Perfil profissional do psicólogo logado: dados, valor, janelas de atendimento e formação. */
export function profileRouter(db: Pool) {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json({ profile: await loadProfile(db, psicologoId(req)) });
  });

  router.put("/", async (req, res) => {
    const psi = psicologoId(req);
    const input = profileSchema.parse(req.body);
    await tx(db, async (c) => {
      await run(c, "UPDATE usuarios SET nome = ? WHERE id = ?", [input.name, userId(req)]);
      await run(c, "UPDATE psicologos SET area_atuacao = ?, bio = ?, valor_sessao_centavos = ? WHERE id = ?", [
        input.areaAtuacao, input.bio, input.feeCents, psi,
      ]);
      await run(c, "DELETE FROM horarios_disponiveis WHERE psicologo_id = ?", [psi]);
      for (const w of input.availability) {
        await run(c, "INSERT INTO horarios_disponiveis (psicologo_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)", [
          psi, w.weekday, w.start, w.end,
        ]);
      }
      await registrarLog(c, { usuarioId: userId(req), acao: "perfil_atualizado", entidade: "perfil", entidadeId: psi });
    });
    res.json({ profile: await loadProfile(db, psi) });
  });

  router.post("/education", async (req, res) => {
    const psi = psicologoId(req);
    const e = educationSchema.parse(req.body);
    await run(db, "INSERT INTO formacoes (psicologo_id, tipo, titulo, instituicao, ano) VALUES (?, ?, ?, ?, ?)", [
      psi, e.kind, e.title, e.institution, e.year ?? null,
    ]);
    res.status(201).json({ profile: await loadProfile(db, psi) });
  });

  router.delete("/education/:id", async (req, res) => {
    const psi = psicologoId(req);
    const info = await run(db, "DELETE FROM formacoes WHERE id = ? AND psicologo_id = ?", [idParam(req.params.id), psi]);
    if (!info.affectedRows) throw new HttpError(404, "Item não encontrado.");
    res.json({ profile: await loadProfile(db, psi) });
  });

  return router;
}
