/**
 * Proveedor de identidad que valida los tokens: el propio deployment de Convex.
 * `CONVEX_SITE_URL` la define Convex automáticamente en cada deployment.
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
