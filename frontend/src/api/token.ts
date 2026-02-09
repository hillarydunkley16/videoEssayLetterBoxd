// // import axios, { AxiosInstance,InternalAxiosRequestConfig } from 'axios'
// // import { store } from '../store'

// const ensureToken = (config: InternalAxiosRequestConfig) => {
//     const state = store.getState()
//     config.headers['Authorization'] = `Token ${state.user?.user?.token}`
//     return config
// }

// const addInterceptors = (instance: AxiosInstance) => {
//     instance.interceptors.request.use(ensureToken)
//     return instance
// }

// const api = axios.create({
//     baseURL: process.env.EXPO_PUBLIC_BASE_API_URL,
// })

// export default addInterceptors(api)