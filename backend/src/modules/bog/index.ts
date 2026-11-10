import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BogPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, { services: [BogPaymentProviderService] })
