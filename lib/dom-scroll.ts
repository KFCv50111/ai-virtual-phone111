type ScrollBlock = "start" | "center" | "end" | "nearest";

type ScrollWithinContainerOptions = {
    behavior?: ScrollBehavior;
    block?: ScrollBlock;
    offsetTop?: number;
};

// iOS PWA 动画帧节流锁，防止高频连发时连续强制触发 getBoundingClientRect 导致 WebKit 崩溃
let scrollRafId: number | null = null;
let pendingScrollTask: (() => void) | null = null;

export function scrollElementWithinContainer(
    container: HTMLElement | null | undefined,
    target: HTMLElement | null | undefined,
    options: ScrollWithinContainerOptions = {},
) {
    if (!container || !target) return;

    // 将高频连续调用合并，在浏览器下一个空闲渲染帧执行
    pendingScrollTask = () => {
        try {
            if (!container || !target || !container.isConnected || !target.isConnected) return;

            // 高频连发时强制使用 auto 避免 smooth 动画在 iOS 上堆积死锁
            const behavior: ScrollBehavior = "auto";
            const block = options.block ?? "nearest";
            const offsetTop = options.offsetTop ?? 0;
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const currentTop = container.scrollTop;
            const visibleBottom = currentTop + container.clientHeight;
            const targetTop = currentTop + targetRect.top - containerRect.top;
            const targetBottom = targetTop + targetRect.height;

            let nextTop = targetTop;
            if (block === "center") {
                nextTop = targetTop - (container.clientHeight - targetRect.height) / 2;
            } else if (block === "end") {
                nextTop = targetBottom - container.clientHeight;
            } else if (block === "nearest") {
                if (targetTop >= currentTop && targetBottom <= visibleBottom) return;
                const distanceToTop = Math.abs(targetTop - currentTop);
                const distanceToBottom = Math.abs(targetBottom - visibleBottom);
                nextTop = distanceToTop <= distanceToBottom ? targetTop : targetBottom - container.clientHeight;
            }

            const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
            const clampedTop = Math.min(maxTop, Math.max(0, nextTop - offsetTop));
            
            container.scrollTop = clampedTop;
        } catch {
            // 容错保护，防止不可预期的 DOM 异常打崩顶层应用
        }
    };

    if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
    }

    scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        if (pendingScrollTask) {
            const task = pendingScrollTask;
            pendingScrollTask = null;
            task();
        }
    });
}
