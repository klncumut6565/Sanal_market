"use client";
import { PushSetup } from "@/components/PushSetup";
import { saveAdminPush, testPush } from "@/app/admin/actions";

/** Yönetici telefonu: yeni siparişte uygulama bildirimi (günlük mesaj gerektirmez, ücretsiz). */
export function AdminPushCard() {
  return <PushSetup title="Bu telefona sipariş bildirimi" onSubscribe={saveAdminPush} onTest={() => testPush("admin")} />;
}
