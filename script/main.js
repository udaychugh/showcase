(function ($) {
    "use strict";

    function parseColor(value) {
        if (!value || value === 'transparent' || value === 'inherit' || value === 'initial' || value === 'none') {
            return null;
        }

        const color = value.trim();

        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const normalizedHex = hex.length === 3
                ? hex.split('').map(function (character) { return character + character; }).join('')
                : hex.length === 4
                    ? hex.split('').map(function (character) { return character + character; }).join('')
                    : hex;

            if (normalizedHex.length !== 6 && normalizedHex.length !== 8) {
                return null;
            }

            const red = parseInt(normalizedHex.slice(0, 2), 16);
            const green = parseInt(normalizedHex.slice(2, 4), 16);
            const blue = parseInt(normalizedHex.slice(4, 6), 16);
            const alpha = normalizedHex.length === 8 ? parseInt(normalizedHex.slice(6, 8), 16) / 255 : 1;

            return {
                r: red,
                g: green,
                b: blue,
                a: alpha
            };
        }

        const match = color.match(/^rgba?\(([^)]+)\)$/i);
        if (!match) {
            return null;
        }

        const parts = match[1].split(',').map(function (part) {
            return part.trim();
        });

        if (parts.length < 3) {
            return null;
        }

        return {
            r: parseFloat(parts[0]),
            g: parseFloat(parts[1]),
            b: parseFloat(parts[2]),
            a: parts.length > 3 ? parseFloat(parts[3]) : 1
        };
    }

    function blendColors(foreground, background) {
        const alpha = foreground.a + background.a * (1 - foreground.a);

        if (alpha === 0) {
            return {
                r: 0,
                g: 0,
                b: 0,
                a: 0
            };
        }

        return {
            r: Math.round((foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha),
            g: Math.round((foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha),
            b: Math.round((foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha),
            a: alpha
        };
    }

    function averageColors(colors) {
        const total = colors.reduce(function (accumulator, color) {
            accumulator.r += color.r;
            accumulator.g += color.g;
            accumulator.b += color.b;
            accumulator.a += color.a;
            return accumulator;
        }, {
            r: 0,
            g: 0,
            b: 0,
            a: 0
        });

        return {
            r: Math.round(total.r / colors.length),
            g: Math.round(total.g / colors.length),
            b: Math.round(total.b / colors.length),
            a: total.a / colors.length
        };
    }

    function relativeLuminance(color) {
        function transform(channel) {
            const normalized = channel / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        }

        return 0.2126 * transform(color.r) + 0.7152 * transform(color.g) + 0.0722 * transform(color.b);
    }

    function contrastRatio(firstColor, secondColor) {
        const lighter = Math.max(relativeLuminance(firstColor), relativeLuminance(secondColor));
        const darker = Math.min(relativeLuminance(firstColor), relativeLuminance(secondColor));
        return (lighter + 0.05) / (darker + 0.05);
    }

    function getGradientColor(backgroundImage) {
        if (!backgroundImage || backgroundImage === 'none' || backgroundImage.indexOf('gradient') === -1) {
            return null;
        }

        const matches = backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g);
        if (!matches || !matches.length) {
            return null;
        }

        const colors = matches.map(parseColor).filter(Boolean);
        if (!colors.length) {
            return null;
        }

        return averageColors(colors);
    }

    function getEffectiveBackgroundColor(element) {
        const fallbackColor = parseColor(getComputedStyle(document.body).backgroundColor) || {
            r: 243,
            g: 243,
            b: 243,
            a: 1
        };
        let currentElement = element;

        while (currentElement) {
            const style = getComputedStyle(currentElement);
            const gradientColor = getGradientColor(style.backgroundImage);
            const backgroundColor = parseColor(style.backgroundColor);

            if (gradientColor) {
                return backgroundColor && backgroundColor.a < 1
                    ? blendColors(gradientColor, backgroundColor)
                    : gradientColor;
            }

            if (backgroundColor && backgroundColor.a > 0) {
                return backgroundColor.a < 1
                    ? blendColors(backgroundColor, fallbackColor)
                    : backgroundColor;
            }

            currentElement = currentElement.parentElement;
        }

        return fallbackColor;
    }

    function getNavbarSampleColor(navbar) {
        const rect = navbar.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            return null;
        }

        const sampleY = Math.min(rect.top + rect.height * 0.72, window.innerHeight - 1);
        const samplePositions = [0.2, 0.5, 0.8];
        const colors = [];

        samplePositions.forEach(function (position) {
            const sampleX = Math.min(Math.max(rect.left + rect.width * position, 1), window.innerWidth - 1);
            const stack = document.elementsFromPoint(sampleX, sampleY);
            const targetElement = stack.find(function (candidate) {
                return !candidate.closest('.navbar');
            });

            if (targetElement) {
                colors.push(getEffectiveBackgroundColor(targetElement));
            }
        });

        if (!colors.length) {
            return null;
        }

        return averageColors(colors);
    }

    function chooseNavbarTextColor(backgroundColor) {
        const candidates = [
            { value: '#ffffff', color: { r: 255, g: 255, b: 255 } },
            { value: '#111111', color: { r: 17, g: 17, b: 17 } },
            { value: '#6b7280', color: { r: 107, g: 114, b: 128 } }
        ];

        let bestCandidate = candidates[0];
        let bestContrast = 0;

        candidates.forEach(function (candidate) {
            const score = contrastRatio(backgroundColor, candidate.color);
            if (score > bestContrast) {
                bestContrast = score;
                bestCandidate = candidate;
            }
        });

        return bestCandidate.value;
    }

    function updateNavbarTextColor() {
        const navbar = document.querySelector('.scrolling-navbar');
        if (!navbar) {
            return;
        }

        if (window.innerWidth <= 991) {
            navbar.style.setProperty('--navbar-text-color', '#1a2410');
            return;
        }

        const sampleColor = getNavbarSampleColor(navbar);
        if (!sampleColor) {
            return;
        }

        navbar.style.setProperty('--navbar-text-color', chooseNavbarTextColor(sampleColor));
    }

    $(window).on('load', function () {
        $('#portfolio').mixItUp();
        $('#preloader').fadeOut();

        let navbarContrastRaf = null;
        function scheduleNavbarTextColorUpdate() {
            if (navbarContrastRaf) {
                return;
            }

            navbarContrastRaf = window.requestAnimationFrame(function () {
                navbarContrastRaf = null;
                updateNavbarTextColor();
            });
        }

        function updateNavbarVisibility() {
            if ($(window).scrollTop() > 100 || window.innerWidth <= 991) {
                $('.scrolling-navbar').addClass('top-nav-collapse');
                $('.scrolling-navbar').removeClass('hidden');
            } else {
                $('.scrolling-navbar').removeClass('top-nav-collapse');
                $('.scrolling-navbar').addClass('hidden');
            }
            scheduleNavbarTextColorUpdate();
        }

        $(window).on('scroll', updateNavbarVisibility);

        function close_toggle() {
            if ($(window).width() <= 768) {
                $('.navbar-collapse a').on('click', function () {
                    $('.navbar-collapse').collapse('hide');
                });
            } else {
                $('.navbar .navbar-inverse a').off('click');
            }
        }
        close_toggle();
        $(window).resize(close_toggle);
        $(window).on('resize', scheduleNavbarTextColorUpdate);
        $('.navbar-nav').onePageNav({
            currentClass: 'active'
        });
        $('.navbar-collapse').on('show.bs.collapse shown.bs.collapse hide.bs.collapse hidden.bs.collapse', function () {
            scheduleNavbarTextColorUpdate();
        });
        $('.mobile-menu').slicknav({
            prependTo: '.navbar-header',
            parentTag: 'liner',
            allowParentLinks: true,
            duplicate: true,
            label: '',
            closedSymbol: '<i class="lni-chevron-right"></i>',
            openedSymbol: '<i class="lni-chevron-down"></i>',
        });
        // Modern Intersection Observer replacing WOW.js
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15
        };
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const delay = el.getAttribute('data-wow-delay') || '0s';
                    el.style.animationDelay = delay;
                    el.classList.add('custom-animated');
                    observer.unobserve(el);
                }
            });
        }, observerOptions);
        $('.wow').each(function() {
            observer.observe(this);
        });
        $('.counter').counterUp({
            time: 1000
        });
        var owl = $("#testimonials");
        owl.owlCarousel({
            loop: true,
            nav: false,
            dots: true,
            center: true,
            margin: 15,
            mouseDrag: false,
            touchDrag: true,
            slideSpeed: 1000,
            stopOnHover: false,
            autoplay: true,
            autoplaySpeed: 1000,
            autoplayTimeout: 10000,
            responsiveClass: true,
            autoplayHoverPause: false,
            responsiveRefreshRate: true,
            responsive: {
                0: {
                    items: 1
                },
                768: {
                    items: 1
                },
                960: {
                    items: 1
                },
                1200: {
                    items: 1
                },
                1920: {
                    items: 1
                }
            }
        });
        $('.video-popup').magnificPopup({
            disableOn: 700,
            type: 'iframe',
            mainClass: 'mfp-fade',
            removalDelay: 160,
            preloader: false,
            fixedContentPos: false,
        });
        $('.lightbox').nivoLightbox({
            effect: 'fadeScale',
            keyboardNav: true,
        });
        updateNavbarVisibility();
        scheduleNavbarTextColorUpdate();
        var offset = 200;
        $(window).scroll(function () {
            if ($(this).scrollTop() > offset) {
                $('.back-to-top').fadeIn(400);
            } else {
                $('.back-to-top').fadeOut(400);
            }
        });
        $('.back-to-top').on('click', function (event) {
            event.preventDefault();
            $('html, body').animate({
                scrollTop: 0
            }, 600);
            return false;
        });
    });
}(jQuery));
