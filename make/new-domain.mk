.PHONY: new-domain

# `make new-domain tir/foo` or `make new-domain NAME=tir/foo`.
# The extra word (tir/foo) is only treated as a do-nothing target when
# new-domain is the first goal, so typos in other targets still fail.
ifeq (new-domain,$(firstword $(MAKECMDGOALS)))
  NEW_DOMAIN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  ifneq ($(NEW_DOMAIN_ARGS),)
    $(eval $(NEW_DOMAIN_ARGS):;@:)
  endif
endif

new-domain:
	node ./scripts/new-domain.mjs '$(or $(NAME),$(NEW_DOMAIN_ARGS))'
