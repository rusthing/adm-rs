import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-muted">
        <Compass size={26} />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold text-ink">页面不存在</h1>
      <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
        这个地址没有对应的前端路由。路由由后端菜单动态生成，当前账号可能没有该菜单，或该组件的路由尚未登记。
      </p>
      <div className="mt-5">
        <Link to="/">
          <Button variant="primary">回到工作台</Button>
        </Link>
      </div>
    </div>
  );
}
