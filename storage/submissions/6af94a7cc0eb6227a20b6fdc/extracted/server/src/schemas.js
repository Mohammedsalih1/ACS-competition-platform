import { z } from 'zod';

export const areaStatusSchema = z.object({
    params: z.object({ id: z.coerce.number().positive()})
});
