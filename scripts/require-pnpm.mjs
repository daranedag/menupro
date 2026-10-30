const agent = process.env.npm_config_user_agent;
if (agent && !agent.startsWith('pnpm/')) {
  console.error('MenuPro utiliza exclusivamente pnpm. Ejecuta pnpm install.');
  process.exit(1);
}
