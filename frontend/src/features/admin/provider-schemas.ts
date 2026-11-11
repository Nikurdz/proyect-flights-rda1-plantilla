import { z } from 'zod';

/** The API accepts http(s) URLs; whether the host is allowed (SSRF defense) is decided by the server. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export const newProviderSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa el nombre (mínimo 2 letras).').max(100, 'Usa como máximo 100 caracteres.'),
  equipo: z.string().trim().min(2, 'Ingresa el equipo responsable (mínimo 2 letras).').max(100, 'Usa como máximo 100 caracteres.'),
  baseUrl: z
    .string()
    .trim()
    .min(1, 'Ingresa la URL base del proveedor.')
    .max(300, 'Usa como máximo 300 caracteres.')
    .refine(isHttpUrl, 'Usa una URL completa que empiece por https://, por ejemplo https://atracciones.example.com/api/v2.'),
  tipoServicio: z.enum(['ATRACCIONES', 'AUTOS', 'ALOJAMIENTOS'], { errorMap: () => ({ message: 'Elige el tipo de servicio.' }) }),
});
export type NewProviderForm = z.infer<typeof newProviderSchema>;
