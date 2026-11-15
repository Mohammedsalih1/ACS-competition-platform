export const validate = schema => (req, res, next) => {
    const parsed = schema.safeParse(req);
    if (!parsed.success) return res.status(400).json({
        message: 'validation falied',
        details: parsed.error.flatten()
    });

    req.valid = parsed.data;
    next();
}