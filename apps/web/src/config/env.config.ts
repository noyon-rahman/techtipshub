import { baseApi } from "@/config/api";

const envConfig = {
  baseApi,
  NODE_ENV: process.env.NODE_ENV,
};

export default envConfig;
